import type { ReactElement, ReactNode } from "react";
import { isValidElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminCourtManagement from "../app/components/admin-court-management";
import Button from "../app/components/button";
import CourtEditorForm from "../app/components/court-editor-form";
import type { Court } from "../app/data/courts";
import { AdminCourtsApiError } from "../app/lib/admin-courts-api";
import type { ApiCourt, CreateAdminCourtPayload } from "../app/types/court";

type HookHarness = {
  cursor: number;
  slots: unknown[];
  effects: Array<() => void | (() => void)>;
};

type ElementProps = {
  children?: ReactNode;
  [key: string]: unknown;
};

const harness = vi.hoisted(() => ({
  activeHooks: null as HookHarness | null,
  useState: vi.fn(),
  useEffect: vi.fn(),
  useMemo: vi.fn(),
  useRef: vi.fn(),
  getAdminCourts: vi.fn(),
  createAdminCourt: vi.fn(),
  refreshUser: vi.fn(),
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useState: (...args: unknown[]) => harness.useState(...args),
    useEffect: (...args: unknown[]) => harness.useEffect(...args),
    useMemo: (...args: unknown[]) => harness.useMemo(...args),
    useRef: (...args: unknown[]) => harness.useRef(...args),
  };
});

vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ refreshUser: harness.refreshUser }),
}));

vi.mock("../app/lib/admin-courts-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../app/lib/admin-courts-api")>();
  return {
    ...actual,
    getAdminCourts: (...args: unknown[]) => harness.getAdminCourts(...args),
    createAdminCourt: (...args: unknown[]) => harness.createAdminCourt(...args),
  };
});

const initialApiCourt: ApiCourt = {
  id: 17,
  name: "Riverside Indoor Court",
  type: "Indoor",
  description: "Indoor courts near the river.",
  hourly_rate: "350.50",
  status: "available",
  location: "Cebu City",
  amenities: ["Parking", "Lighting"],
  opening_time: "08:00:00",
  closing_time: "22:00:00",
  operating_days: ["Monday", "Tuesday"],
  image: null,
  created_at: null,
  updated_at: null,
};

const createdApiCourt: ApiCourt = {
  ...initialApiCourt,
  id: 42,
  name: "New Harbor Court",
  type: "Outdoor",
  hourly_rate: 325,
  status: "unavailable",
  location: "Cebu Harbor",
  opening_time: "07:30:00",
  closing_time: "21:00:00",
  operating_days: null,
};

const validChanges: Omit<Court, "id"> = {
  name: "New Harbor Court",
  description: "An outdoor court beside the harbor.",
  category: "Outdoor",
  pricePerHour: 325,
  location: "Cebu Harbor",
  amenities: ["Parking", "Lighting"],
  operatingHours: "Daily, 7:30 AM - 9:00 PM",
  openingTime: "07:30",
  closingTime: "21:00",
  operatingDays: undefined,
  artwork: "outdoor",
  image: undefined,
  available: false,
};

function createHookHarness(): HookHarness {
  return { cursor: 0, slots: [], effects: [] };
}

function renderWith<T>(hooks: HookHarness, render: () => T): T {
  harness.activeHooks = hooks;
  hooks.cursor = 0;
  hooks.effects = [];
  return render();
}

function allElements(node: ReactNode): ReactElement<ElementProps>[] {
  if (Array.isArray(node)) {
    return node.flatMap((child) => allElements(child));
  }

  if (!isValidElement(node)) {
    return [];
  }

  const element = node as ReactElement<ElementProps>;
  return [element, ...allElements(element.props.children)];
}

function textContent(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(textContent).join("");
  }

  if (isValidElement(node)) {
    return textContent((node.props as ElementProps).children);
  }

  return "";
}

function propsOf(element: ReactElement<ElementProps>): ElementProps {
  return element.props;
}

function findElement(
  node: ReactNode,
  predicate: (element: ReactElement<ElementProps>) => boolean,
): ReactElement<ElementProps> | undefined {
  return allElements(node).find(predicate);
}

function findButton(node: ReactNode, label: string) {
  return findElement(
    node,
    (element) => element.type === Button && textContent(element.props.children).trim() === label,
  );
}

function createButtonClick(element: ReactElement<ElementProps> | undefined) {
  const onClick = propsOf(element as ReactElement<ElementProps>).onClick;
  if (typeof onClick !== "function") {
    throw new Error("Expected the button to have an onClick handler.");
  }
  return onClick as () => void;
}

function renderManagement(hooks: HookHarness) {
  return renderWith(hooks, () => AdminCourtManagement());
}

function renderEditor(
  hooks: HookHarness,
  props: ElementProps,
) {
  return renderWith(hooks, () => CourtEditorForm(props as never));
}

async function loadCourts(hooks: HookHarness) {
  const tree = renderManagement(hooks);
  const effect = hooks.effects[0];
  if (!effect) throw new Error("Expected the court loading effect.");
  effect();
  return tree;
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function openCreationEditor(hooks: HookHarness) {
  const tree = renderManagement(hooks);
  createButtonClick(findButton(tree, "Add Court"))();
  const openedTree = renderManagement(hooks);
  const editor = findElement(openedTree, (element) => element.type === CourtEditorForm);
  if (!editor) throw new Error("Expected the court editor to open.");
  return { tree: openedTree, editor, props: propsOf(editor) };
}

function changeEditorValue(
  hooks: HookHarness,
  props: ElementProps,
  id: string,
  value: string,
) {
  const tree = renderEditor(hooks, props);
  const input = findElement(tree, (element) => propsOf(element).id === id);
  if (!input) throw new Error(`Expected to find editor field ${id}.`);
  const onChange = propsOf(input).onChange;
  if (typeof onChange !== "function") throw new Error(`Expected ${id} to have onChange.`);
  (onChange as (event: { target: { value: string } }) => void)({ target: { value } });
  return renderEditor(hooks, props);
}

function fillEditor(hooks: HookHarness, props: ElementProps) {
  changeEditorValue(hooks, props, "court-name", "New Harbor Court");
  changeEditorValue(hooks, props, "court-location", "Cebu Harbor");
  changeEditorValue(hooks, props, "court-description", "An outdoor court beside the harbor.");
  changeEditorValue(hooks, props, "court-type", "Outdoor");
  changeEditorValue(hooks, props, "court-rate", "325");
  changeEditorValue(hooks, props, "court-opening-time", "07:30");
  changeEditorValue(hooks, props, "court-closing-time", "21:00");

  let tree = renderEditor(hooks, props);
  const amenity = findElement(
    tree,
    (element) => propsOf(element).type === "checkbox",
  );
  if (!amenity) throw new Error("Expected to find the amenity checkbox.");
  const onChange = propsOf(amenity).onChange;
  if (typeof onChange !== "function") throw new Error("Expected the amenity checkbox handler.");
  (onChange as () => void)();
  tree = renderEditor(hooks, props);

  const status = findElement(tree, (element) => propsOf(element).id === "court-status");
  if (!status) throw new Error("Expected to find the availability field.");
  const statusChange = propsOf(status).onChange;
  if (typeof statusChange !== "function") throw new Error("Expected the availability handler.");
  (statusChange as (event: { target: { value: string } }) => void)({
    target: { value: "false" },
  });
  return renderEditor(hooks, props);
}

function findForm(tree: ReactNode) {
  const form = findElement(tree, (element) => element.type === "form");
  if (!form) throw new Error("Expected the court editor form.");
  return form;
}

describe("Admin Court Management creation workflow", () => {
  let managementHooks: HookHarness;
  let editorHooks: HookHarness;

  beforeEach(() => {
    vi.clearAllMocks();
    managementHooks = createHookHarness();
    editorHooks = createHookHarness();
    harness.activeHooks = null;

    harness.useState.mockImplementation((initial: unknown) => {
      const hooks = harness.activeHooks;
      if (!hooks) throw new Error("useState called without an active hook harness.");
      const index = hooks.cursor++;
      if (!(index in hooks.slots)) {
        hooks.slots[index] = typeof initial === "function"
          ? (initial as () => unknown)()
          : initial;
      }
      const setState = (next: unknown) => {
        const current = hooks.slots[index];
        hooks.slots[index] = typeof next === "function"
          ? (next as (value: unknown) => unknown)(current)
          : next;
      };
      return [hooks.slots[index], setState];
    });
    harness.useEffect.mockImplementation((effect: () => void | (() => void)) => {
      const hooks = harness.activeHooks;
      if (!hooks) throw new Error("useEffect called without an active hook harness.");
      hooks.cursor += 1;
      hooks.effects.push(effect);
    });
    harness.useMemo.mockImplementation((factory: () => unknown) => {
      const hooks = harness.activeHooks;
      if (!hooks) throw new Error("useMemo called without an active hook harness.");
      hooks.cursor += 1;
      return factory();
    });
    harness.useRef.mockImplementation((initial: unknown) => {
      const hooks = harness.activeHooks;
      if (!hooks) throw new Error("useRef called without an active hook harness.");
      const index = hooks.cursor++;
      if (!(index in hooks.slots)) hooks.slots[index] = { current: initial };
      return hooks.slots[index];
    });

    harness.getAdminCourts.mockResolvedValue([initialApiCourt]);
    harness.createAdminCourt.mockResolvedValue({ status: 200, message: "Court created" });
    harness.refreshUser.mockResolvedValue(undefined);
  });

  it("shows loading during the initial GET and displays mapped court data", async () => {
    const request = deferred<ApiCourt[]>();
    harness.getAdminCourts.mockReturnValueOnce(request.promise);

    const initialTree = await loadCourts(managementHooks);
    expect(textContent(initialTree)).toContain("Loading courts...");
    expect(harness.getAdminCourts).toHaveBeenCalledTimes(1);
    expect(harness.createAdminCourt).not.toHaveBeenCalled();

    request.resolve([initialApiCourt]);
    await flushPromises();
    const loadedTree = renderManagement(managementHooks);
    expect(textContent(loadedTree)).toContain("Riverside Indoor Court");
    expect(textContent(loadedTree)).toContain("Cebu City");
  });

  it("shows an initial GET error and retries the list without creating a court", async () => {
    harness.getAdminCourts
      .mockRejectedValueOnce(new Error("Court service unavailable"));

    await loadCourts(managementHooks);
    await flushPromises();
    let tree = renderManagement(managementHooks);
    expect(textContent(tree)).toContain("Court service unavailable");

    const retry = findElement(
      tree,
      (element) => element.type === "button" && textContent(element.props.children).trim() === "Retry",
    );
    const onRetry = propsOf(retry as ReactElement<ElementProps>).onClick;
    if (typeof onRetry !== "function") throw new Error("Expected the Retry handler.");
    (onRetry as () => void)();

    const pendingRequest = deferred<ApiCourt[]>();
    harness.getAdminCourts.mockReturnValueOnce(pendingRequest.promise);
    tree = renderManagement(managementHooks);
    expect(textContent(tree)).toContain("Loading courts...");
    expect(textContent(tree)).not.toContain("Court service unavailable");
    const retryEffect = managementHooks.effects[0];
    if (!retryEffect) throw new Error("Expected the retry loading effect.");
    retryEffect();
    expect(harness.getAdminCourts).toHaveBeenCalledTimes(2);

    pendingRequest.resolve([createdApiCourt]);
    await flushPromises();
    tree = renderManagement(managementHooks);
    expect(textContent(tree)).toContain("New Harbor Court");
    expect(harness.createAdminCourt).not.toHaveBeenCalled();
  });

  it("opens the create editor and keeps navigation, filters, Edit, and Delete behavior intact", async () => {
    const tree = await loadCourts(managementHooks);
    const loadedTree = renderManagement(managementHooks);
    expect(textContent(tree)).toContain("Loading courts...");

    const addButton = findButton(loadedTree, "Add Court");
    expect(propsOf(addButton as ReactElement<ElementProps>).disabled).toBe(false);
    createButtonClick(addButton)();
    const openTree = renderManagement(managementHooks);
    const editor = findElement(openTree, (element) => element.type === CourtEditorForm);
    expect(editor).toBeDefined();
    expect(propsOf(editor as ReactElement<ElementProps>).initialCourt).toBeNull();
    expect(findElement(openTree, (element) => propsOf(element).id === "admin-court-search")).toBeDefined();
    expect(allElements(openTree).some((element) => propsOf(element).href === "/courts/17")).toBe(true);

    const actionButtons = allElements(openTree).filter(
      (element) => element.type === "button" && ["Edit", "Delete"].includes(textContent(element.props.children).trim()),
    );
    expect(actionButtons).toHaveLength(2);
    expect(actionButtons.every((element) => propsOf(element).disabled === true)).toBe(true);
  });

  it("maps editor values, waits for persisted refresh, then closes with success feedback", async () => {
    const refresh = deferred<ApiCourt[]>();
    harness.getAdminCourts
      .mockResolvedValueOnce([initialApiCourt])
      .mockReturnValueOnce(refresh.promise);
    await loadCourts(managementHooks);
    const { props } = await openCreationEditor(managementHooks);

    const onSave = props.onSave;
    if (typeof onSave !== "function") throw new Error("Expected the editor save callback.");
    const savePromise = (onSave as (changes: Omit<Court, "id">) => Promise<void>)(validChanges);
    await flushPromises();

    const expectedPayload: CreateAdminCourtPayload = {
      name: "New Harbor Court",
      type: "Outdoor",
      hourly_rate: 325,
      status: "unavailable",
      description: "An outdoor court beside the harbor.",
      location: "Cebu Harbor",
      amenities: ["Parking", "Lighting"],
      opening_time: "07:30",
      closing_time: "21:00",
    };
    expect(harness.createAdminCourt).toHaveBeenCalledTimes(1);
    expect(harness.createAdminCourt).toHaveBeenCalledWith(expectedPayload);
    expect(harness.getAdminCourts).toHaveBeenCalledTimes(2);

    let tree = renderManagement(managementHooks);
    expect(findElement(tree, (element) => element.type === CourtEditorForm)).toBeDefined();
    expect(textContent(tree)).toContain("Court saved. Refreshing the court list...");
    const pendingEditor = findElement(tree, (element) => element.type === CourtEditorForm);
    expect(propsOf(pendingEditor as ReactElement<ElementProps>).isSubmitting).toBe(true);
    const pendingForm = renderEditor(
      editorHooks,
      propsOf(pendingEditor as ReactElement<ElementProps>),
    );
    expect(propsOf(findForm(pendingForm))["aria-busy"]).toBe(true);
    expect(textContent(pendingForm)).toContain("Refreshing courts...");
    expect(textContent(tree)).not.toContain("Court created successfully.");

    refresh.resolve([initialApiCourt, createdApiCourt]);
    await savePromise;
    tree = renderManagement(managementHooks);
    expect(findElement(tree, (element) => element.type === CourtEditorForm)).toBeUndefined();
    expect(textContent(tree)).toContain("Court created successfully.");
    expect(textContent(tree)).toContain("New Harbor Court");
    expect(harness.getAdminCourts).toHaveBeenCalledTimes(2);
  });

  it("maps an available editor value to Laravel's available status", async () => {
    await loadCourts(managementHooks);
    const { props } = await openCreationEditor(managementHooks);
    const onSave = props.onSave as (changes: Omit<Court, "id">) => Promise<void>;

    await onSave({ ...validChanges, available: true });

    expect(harness.createAdminCourt).toHaveBeenCalledWith(
      expect.objectContaining({ status: "available" }),
    );
    expect(harness.createAdminCourt).toHaveBeenCalledTimes(1);
  });

  it("prevents duplicate POSTs and disables Add Court while creation is pending", async () => {
    const createRequest = deferred<{ status: number; message: string }>();
    harness.createAdminCourt.mockReturnValueOnce(createRequest.promise);
    await loadCourts(managementHooks);
    const { props } = await openCreationEditor(managementHooks);
    const onSave = props.onSave as (changes: Omit<Court, "id">) => Promise<void>;

    const firstSave = onSave(validChanges);
    const duplicateSave = onSave(validChanges);
    await duplicateSave;
    let tree = renderManagement(managementHooks);
    expect(harness.createAdminCourt).toHaveBeenCalledTimes(1);
    expect(propsOf(findButton(tree, "Add Court") as ReactElement<ElementProps>).disabled).toBe(true);
    const editor = findElement(tree, (element) => element.type === CourtEditorForm);
    expect(propsOf(editor as ReactElement<ElementProps>).isSubmitting).toBe(true);
    const pendingForm = renderEditor(
      editorHooks,
      propsOf(editor as ReactElement<ElementProps>),
    );
    expect(propsOf(findForm(pendingForm))["aria-busy"]).toBe(true);
    expect(textContent(pendingForm)).toContain("Saving court...");
    expect(textContent(tree)).not.toContain("Court created successfully.");

    createRequest.resolve({ status: 200, message: "Court created" });
    await firstSave;
    tree = renderManagement(managementHooks);
    expect(harness.createAdminCourt).toHaveBeenCalledTimes(1);
    expect(harness.getAdminCourts).toHaveBeenCalledTimes(2);
    expect(textContent(tree)).toContain("Court created successfully.");
  });

  it("shows Laravel field errors and preserves entered values for correction", async () => {
    harness.createAdminCourt.mockRejectedValueOnce(
      new AdminCourtsApiError("The given data was invalid.", 422, {
        hourly_rate: ["The hourly rate must be at least 0."],
        "amenities.0": ["The selected amenity is invalid."],
      }),
    );
    await loadCourts(managementHooks);
    const { props } = await openCreationEditor(managementHooks);
    let formTree = fillEditor(editorHooks, props);
    const form = findForm(formTree);
    const onSubmit = propsOf(form).onSubmit;
    if (typeof onSubmit !== "function") throw new Error("Expected the editor submit handler.");
    await (onSubmit as (event: { preventDefault: () => void }) => Promise<void>)( {
      preventDefault: vi.fn(),
    });

    const managementTree = renderManagement(managementHooks);
    const editor = findElement(managementTree, (element) => element.type === CourtEditorForm);
    expect(editor).toBeDefined();
    const updatedProps = propsOf(editor as ReactElement<ElementProps>);
    expect(updatedProps.serverFieldErrors).toMatchObject({
      pricePerHour: "The hourly rate must be at least 0.",
      amenities: "The selected amenity is invalid.",
    });
    expect(updatedProps.submissionError).toContain("hourly_rate: The hourly rate must be at least 0.");

    formTree = renderEditor(editorHooks, updatedProps);
    const rate = findElement(formTree, (element) => propsOf(element).id === "court-rate");
    expect(propsOf(rate as ReactElement<ElementProps>).value).toBe("325");
    expect(propsOf(rate as ReactElement<ElementProps>)["aria-invalid"]).toBe(true);
    expect(textContent(formTree)).toContain("The hourly rate must be at least 0.");
    expect(harness.createAdminCourt).toHaveBeenCalledTimes(1);
    expect(textContent(managementTree)).not.toContain("Court created successfully.");
  });

  it.each([
    [401, "Your session has expired. Checking authentication..."],
    [403, "You do not have permission to create courts."],
    [419, "Your session or CSRF token has expired. Refresh the page and sign in again."],
  ])("keeps the editor open and shows HTTP %i feedback", async (status, expectedMessage) => {
    harness.createAdminCourt.mockRejectedValueOnce(
      new AdminCourtsApiError("Request denied", status),
    );
    await loadCourts(managementHooks);
    const { props } = await openCreationEditor(managementHooks);
    const onSave = props.onSave as (changes: Omit<Court, "id">) => Promise<void>;
    await onSave(validChanges);

    const tree = renderManagement(managementHooks);
    expect(findElement(tree, (element) => element.type === CourtEditorForm)).toBeDefined();
    const editor = findElement(tree, (element) => element.type === CourtEditorForm);
    expect(propsOf(editor as ReactElement<ElementProps>).submissionError).toBe(expectedMessage);
    expect(textContent(tree)).not.toContain("Court created successfully.");
    expect(harness.getAdminCourts).toHaveBeenCalledTimes(1);
    if (status === 401) expect(harness.refreshUser).toHaveBeenCalledTimes(1);
    else expect(harness.refreshUser).not.toHaveBeenCalled();
  });

  it("does not retry a failed or uncertain POST automatically", async () => {
    harness.createAdminCourt.mockRejectedValueOnce(new TypeError("Network unavailable"));
    await loadCourts(managementHooks);
    const { props } = await openCreationEditor(managementHooks);
    const onSave = props.onSave as (changes: Omit<Court, "id">) => Promise<void>;
    await onSave(validChanges);

    const tree = renderManagement(managementHooks);
    expect(harness.createAdminCourt).toHaveBeenCalledTimes(1);
    expect(harness.getAdminCourts).toHaveBeenCalledTimes(1);
    expect(textContent(tree)).toContain("The request outcome is unclear.");
    expect(textContent(tree)).not.toContain("Court created successfully.");
    const editor = findElement(tree, (element) => element.type === CourtEditorForm);
    expect(editor).toBeDefined();
    expect(propsOf(editor as ReactElement<ElementProps>).submissionError).toContain(
      "We could not confirm whether the court was saved.",
    );
    await (propsOf(editor as ReactElement<ElementProps>).onSave as (
      changes: Omit<Court, "id">,
    ) => Promise<void>)(validChanges);
    expect(harness.createAdminCourt).toHaveBeenCalledTimes(1);
  });

  it("shows server failure feedback without automatically retrying creation", async () => {
    harness.createAdminCourt.mockRejectedValueOnce(
      new AdminCourtsApiError("Court service failed.", 500),
    );
    await loadCourts(managementHooks);
    const { props } = await openCreationEditor(managementHooks);
    const onSave = props.onSave as (changes: Omit<Court, "id">) => Promise<void>;
    await onSave(validChanges);

    const tree = renderManagement(managementHooks);
    const editor = findElement(tree, (element) => element.type === CourtEditorForm);
    expect(propsOf(editor as ReactElement<ElementProps>).submissionError).toBe(
      "Court service failed.",
    );
    expect(harness.createAdminCourt).toHaveBeenCalledTimes(1);
    expect(harness.getAdminCourts).toHaveBeenCalledTimes(1);
    expect(textContent(tree)).not.toContain("Court created successfully.");
  });

  it("reconciles a failed post-create refresh with GET only and blocks another POST", async () => {
    harness.getAdminCourts
      .mockResolvedValueOnce([initialApiCourt])
      .mockRejectedValueOnce(new Error("Refresh unavailable"))
      .mockResolvedValueOnce([initialApiCourt, createdApiCourt]);
    await loadCourts(managementHooks);
    const { props } = await openCreationEditor(managementHooks);
    const onSave = props.onSave as (changes: Omit<Court, "id">) => Promise<void>;
    await onSave(validChanges);

    let tree = renderManagement(managementHooks);
    expect(textContent(tree)).toContain("The court was saved, but the list could not be refreshed.");
    const editor = findElement(tree, (element) => element.type === CourtEditorForm);
    expect(editor).toBeDefined();
    expect(harness.createAdminCourt).toHaveBeenCalledTimes(1);
    await (propsOf(editor as ReactElement<ElementProps>).onSave as (
      changes: Omit<Court, "id">,
    ) => Promise<void>)(validChanges);
    expect(harness.createAdminCourt).toHaveBeenCalledTimes(1);

    const refreshButton = findButton(tree, "Refresh court list");
    createButtonClick(refreshButton)();
    await flushPromises();
    tree = renderManagement(managementHooks);
    expect(textContent(tree)).toContain("New Harbor Court");
    expect(textContent(tree)).toContain("Court created successfully.");
    expect(findElement(tree, (element) => element.type === CourtEditorForm)).toBeUndefined();
    expect(harness.getAdminCourts).toHaveBeenCalledTimes(3);
    expect(harness.createAdminCourt).toHaveBeenCalledTimes(1);
  });
});
