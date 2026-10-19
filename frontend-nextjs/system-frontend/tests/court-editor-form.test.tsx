import type { ComponentProps, ReactElement, ReactNode } from "react";
import { isValidElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CourtEditorForm from "../app/components/court-editor-form";
import Button from "../app/components/button";
import type { Court } from "../app/data/courts";

type HookHarness = {
  cursor: number;
  slots: unknown[];
};

type ElementProps = {
  children?: ReactNode;
  [key: string]: unknown;
};

type FormProps = ComponentProps<typeof CourtEditorForm>;

const harness = vi.hoisted(() => ({
  activeHooks: null as HookHarness | null,
  useState: vi.fn(),
  useRef: vi.fn(),
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useState: (...args: unknown[]) => harness.useState(...args),
    useRef: (...args: unknown[]) => harness.useRef(...args),
  };
});

const editingCourt: Court = {
  id: "court-17",
  name: "Riverside Indoor Court",
  description: "Indoor courts near the river.",
  category: "Indoor",
  pricePerHour: 350.5,
  location: "Cebu City",
  amenities: ["Parking", "Lighting"],
  operatingHours: "Monday, 8:00 AM - 10:00 PM",
  openingTime: "08:00",
  closingTime: "22:00",
  operatingDays: [1],
  artwork: "indoor",
  image: "/img/riverside.png",
  available: true,
};

const validSubmittedValues: Omit<Court, "id"> = {
  name: "New Harbor Court",
  description: "An outdoor court beside the harbor.",
  category: "Outdoor",
  pricePerHour: 325,
  location: "Cebu Harbor",
  amenities: ["Parking"],
  operatingHours: "Daily, 7:30 AM - 9:00 PM",
  openingTime: "07:30",
  closingTime: "21:00",
  operatingDays: undefined,
  artwork: "outdoor",
  image: undefined,
  available: false,
};

function createHookHarness(): HookHarness {
  return { cursor: 0, slots: [] };
}

function renderForm(hooks: HookHarness, props: FormProps) {
  harness.activeHooks = hooks;
  hooks.cursor = 0;
  return CourtEditorForm(props);
}

function allElements(node: ReactNode): ReactElement<ElementProps>[] {
  if (Array.isArray(node)) return node.flatMap((child) => allElements(child));
  if (!isValidElement(node)) return [];

  const element = node as ReactElement<ElementProps>;
  return [element, ...allElements(element.props.children)];
}

function textContent(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textContent).join("");
  if (isValidElement(node)) return textContent((node.props as ElementProps).children);
  return "";
}

function propsOf(element: ReactElement<ElementProps>) {
  return element.props;
}

function findElement(
  tree: ReactNode,
  predicate: (element: ReactElement<ElementProps>) => boolean,
) {
  return allElements(tree).find(predicate);
}

function findField(tree: ReactNode, id: string) {
  const field = findElement(tree, (element) => propsOf(element).id === id);
  if (!field) throw new Error(`Expected form field ${id}.`);
  return field;
}

function findForm(tree: ReactNode) {
  const form = findElement(tree, (element) => element.type === "form");
  if (!form) throw new Error("Expected the court editor form element.");
  return form;
}

function findSubmitButton(tree: ReactNode) {
  const button = findElement(
    tree,
    (element) => element.type === Button && propsOf(element).type === "submit",
  );
  if (!button) throw new Error("Expected the submit button.");
  return button;
}

function submit(tree: ReactNode) {
  const onSubmit = propsOf(findForm(tree)).onSubmit;
  if (typeof onSubmit !== "function") throw new Error("Expected the form submit handler.");
  return (onSubmit as (event: { preventDefault: () => void }) => Promise<void>)( {
    preventDefault: vi.fn(),
  });
}

function changeField(
  hooks: HookHarness,
  props: FormProps,
  id: string,
  value: string,
) {
  const tree = renderForm(hooks, props);
  const onChange = propsOf(findField(tree, id)).onChange;
  if (typeof onChange !== "function") throw new Error(`Expected ${id} to have onChange.`);
  (onChange as (event: { target: { value: string } }) => void)({ target: { value } });
  return renderForm(hooks, props);
}

function fillValidForm(hooks: HookHarness, props: FormProps) {
  changeField(hooks, props, "court-name", "  New Harbor Court  ");
  changeField(hooks, props, "court-location", "  Cebu Harbor  ");
  changeField(hooks, props, "court-description", "  An outdoor court beside the harbor.  ");
  changeField(hooks, props, "court-type", "Outdoor");
  changeField(hooks, props, "court-rate", "325");
  changeField(hooks, props, "court-opening-time", "07:30");
  changeField(hooks, props, "court-closing-time", "21:00");

  let tree = renderForm(hooks, props);
  const amenity = allElements(tree).find((element) => propsOf(element).type === "checkbox");
  if (!amenity) throw new Error("Expected an amenity checkbox.");
  const toggleAmenity = propsOf(amenity).onChange;
  if (typeof toggleAmenity !== "function") throw new Error("Expected the amenity change handler.");
  (toggleAmenity as () => void)();
  tree = renderForm(hooks, props);

  const statusChange = propsOf(findField(tree, "court-status")).onChange;
  if (typeof statusChange !== "function") throw new Error("Expected the availability change handler.");
  (statusChange as (event: { target: { value: string } }) => void)({
    target: { value: "false" },
  });
  return renderForm(hooks, props);
}

function makeProps(overrides: Partial<FormProps> = {}): FormProps {
  return {
    initialCourt: null,
    onSave: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
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

describe("CourtEditorForm", () => {
  let hooks: HookHarness;

  beforeEach(() => {
    vi.clearAllMocks();
    hooks = createHookHarness();
    harness.activeHooks = null;

    harness.useState.mockImplementation((initial: unknown) => {
      const activeHooks = harness.activeHooks;
      if (!activeHooks) throw new Error("useState called without an active hook harness.");
      const index = activeHooks.cursor++;
      if (!(index in activeHooks.slots)) {
        activeHooks.slots[index] = typeof initial === "function"
          ? (initial as () => unknown)()
          : initial;
      }
      const setState = (next: unknown) => {
        const current = activeHooks.slots[index];
        activeHooks.slots[index] = typeof next === "function"
          ? (next as (value: unknown) => unknown)(current)
          : next;
      };
      return [activeHooks.slots[index], setState];
    });
    harness.useRef.mockImplementation((initial: unknown) => {
      const activeHooks = harness.activeHooks;
      if (!activeHooks) throw new Error("useRef called without an active hook harness.");
      const index = activeHooks.cursor++;
      if (!(index in activeHooks.slots)) activeHooks.slots[index] = { current: initial };
      return activeHooks.slots[index];
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("initializes create mode with blank values and Add Court labels", () => {
    const tree = renderForm(hooks, makeProps());

    expect(textContent(tree)).toContain("Add Court");
    expect(propsOf(findField(tree, "court-name")).value).toBe("");
    expect(propsOf(findField(tree, "court-description")).value).toBe("");
    expect(propsOf(findField(tree, "court-type")).value).toBe("");
    expect(propsOf(findField(tree, "court-location")).value).toBe("");
    expect(propsOf(findField(tree, "court-rate")).value).toBe("");
    expect(propsOf(findField(tree, "court-opening-time")).value).toBe("");
    expect(propsOf(findField(tree, "court-closing-time")).value).toBe("");
    expect(propsOf(findField(tree, "court-status")).value).toBe("");
    expect(allElements(tree).filter((element) => propsOf(element).type === "checkbox")
      .every((element) => propsOf(element).checked === false)).toBe(true);
    expect(textContent(findSubmitButton(tree))).toContain("Add Court");
  });

  it("populates edit mode values and uses edit labels", () => {
    const tree = renderForm(hooks, makeProps({ initialCourt: editingCourt }));

    expect(textContent(tree)).toContain("Edit Court");
    expect(propsOf(findField(tree, "court-name")).value).toBe(editingCourt.name);
    expect(propsOf(findField(tree, "court-description")).value).toBe(editingCourt.description);
    expect(propsOf(findField(tree, "court-type")).value).toBe("Indoor");
    expect(propsOf(findField(tree, "court-location")).value).toBe("Cebu City");
    expect(propsOf(findField(tree, "court-rate")).value).toBe("350.5");
    expect(propsOf(findField(tree, "court-opening-time")).value).toBe("08:00");
    expect(propsOf(findField(tree, "court-closing-time")).value).toBe("22:00");
    expect(propsOf(findField(tree, "court-status")).value).toBe("true");
    expect(textContent(findSubmitButton(tree))).toContain("Save Changes");
    const checkboxes = allElements(tree).filter((element) => propsOf(element).type === "checkbox");
    expect(checkboxes.filter((element) => propsOf(element).checked === true)).toHaveLength(2);
  });

  it("shows all missing-field validation errors and does not save", async () => {
    const props = makeProps();
    await submit(renderForm(hooks, props));
    const tree = renderForm(hooks, props);

    for (const message of [
      "Court name is required.",
      "Description is required.",
      "Select a court type.",
      "Location is required.",
      "Enter an hourly rate greater than zero.",
      "Opening time is required.",
      "Closing time is required.",
      "Select at least one amenity.",
      "Select an availability status.",
    ]) {
      expect(textContent(tree)).toContain(message);
    }
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it("rejects whitespace text, non-positive rates, and closing times before opening", async () => {
    const props = makeProps();
    fillValidForm(hooks, props);
    changeField(hooks, props, "court-name", "   ");
    changeField(hooks, props, "court-location", "   ");
    changeField(hooks, props, "court-description", "   ");
    changeField(hooks, props, "court-rate", "0");
    changeField(hooks, props, "court-closing-time", "07:29");

    await submit(renderForm(hooks, props));
    let tree = renderForm(hooks, props);

    expect(textContent(tree)).toContain("Court name is required.");
    expect(textContent(tree)).toContain("Description is required.");
    expect(textContent(tree)).toContain("Location is required.");
    expect(textContent(tree)).toContain("Enter an hourly rate greater than zero.");
    expect(textContent(tree)).toContain("Closing time must be later than opening time.");
    expect(props.onSave).not.toHaveBeenCalled();

    changeField(hooks, props, "court-rate", "not-a-number");
    await submit(renderForm(hooks, props));
    tree = renderForm(hooks, props);
    expect(textContent(tree)).toContain("Enter an hourly rate greater than zero.");
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it("submits trimmed editor values without making an API request", async () => {
    const onSave = vi.fn<(changes: Omit<Court, "id">) => void | Promise<void>>();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const props = makeProps({ onSave });
    const tree = fillValidForm(hooks, props);

    await submit(tree);

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(validSubmittedValues);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("awaits onSave and reflects the parent-provided asynchronous pending state", async () => {
    const request = deferred<void>();
    const onSave = vi.fn(() => request.promise);
    const props = makeProps({ onSave });
    const validTree = fillValidForm(hooks, props);
    let submissionFinished = false;
    const submission = submit(validTree).then(() => { submissionFinished = true; });

    expect(submissionFinished).toBe(false);
    expect(onSave).toHaveBeenCalledTimes(1);
    const pendingTree = renderForm(hooks, { ...props, isSubmitting: true, submitPendingLabel: "Saving court..." });
    expect(propsOf(findForm(pendingTree))["aria-busy"]).toBe(true);
    expect(propsOf(findSubmitButton(pendingTree)).disabled).toBe(true);
    expect(textContent(findSubmitButton(pendingTree))).toContain("Saving court...");
    expect(findElement(pendingTree, (element) => propsOf(element).role === "status")).toBeUndefined();

    request.resolve();
    await submission;
    expect(submissionFinished).toBe(true);
    const settledTree = renderForm(hooks, props);
    expect(propsOf(findSubmitButton(settledTree)).disabled).toBe(false);
    expect(textContent(findSubmitButton(settledTree))).toContain("Add Court");
  });

  it("blocks a second submit while the first onSave promise is pending", async () => {
    const request = deferred<void>();
    const onSave = vi.fn(() => request.promise);
    const props = makeProps({ onSave });
    const validTree = fillValidForm(hooks, props);
    const firstSubmission = submit(validTree);
    await submit(validTree);

    expect(onSave).toHaveBeenCalledTimes(1);
    request.resolve();
    await firstSubmission;
  });

  it("retains values after onSave rejects and allows a corrected resubmission", async () => {
    const saveFailure = new Error("Unable to save court.");
    const onSave = vi.fn()
      .mockRejectedValueOnce(saveFailure)
      .mockResolvedValueOnce(undefined);
    const props = makeProps({ onSave });
    fillValidForm(hooks, props);

    await expect(submit(renderForm(hooks, props))).rejects.toBe(saveFailure);
    let tree = renderForm(hooks, { ...props, submissionError: saveFailure.message });
    expect(propsOf(findField(tree, "court-name")).value).toBe("  New Harbor Court  ");
    expect(textContent(tree)).toContain("Unable to save court.");
    expect(propsOf(findSubmitButton(tree)).disabled).toBe(false);

    changeField(hooks, props, "court-name", "Corrected Harbor Court");
    tree = renderForm(hooks, props);
    await submit(tree);
    expect(onSave).toHaveBeenCalledTimes(2);
    expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({
      name: "Corrected Harbor Court",
    }));
  });

  it("shows server field errors separately and clears a field error when corrected", async () => {
    const onSave = vi.fn();
    const props = makeProps({
      onSave,
      submissionError: "The hourly rate must be at least 0.",
      serverFieldErrors: { pricePerHour: "The hourly rate must be at least 0." },
    });
    let tree = renderForm(hooks, props);

    expect(propsOf(findField(tree, "court-rate"))["aria-invalid"]).toBe(true);
    expect(textContent(tree)).toContain("The hourly rate must be at least 0.");
    expect(allElements(tree).filter((element) => propsOf(element).role === "alert")).toHaveLength(2);
    expect(findElement(
      tree,
      (element) => propsOf(element).id === "court-pricePerHour-error",
    )).toBeDefined();

    tree = fillValidForm(hooks, props);
    expect(propsOf(findField(tree, "court-rate"))["aria-invalid"]).toBe(false);
    await submit(tree);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("prevents submission while externally pending or locked and supports Cancel", async () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    const pendingProps = makeProps({
      onSave,
      onCancel,
      isSubmitting: true,
      submitPendingLabel: "Saving court...",
    });
    let tree = renderForm(hooks, pendingProps);
    await submit(tree);
    expect(onSave).not.toHaveBeenCalled();
    expect(propsOf(findSubmitButton(tree)).disabled).toBe(true);
    expect(textContent(findSubmitButton(tree))).toContain("Saving court...");

    const lockedProps = makeProps({
      onSave,
      onCancel,
      isSubmitLocked: true,
      submitLockedLabel: "Refresh before retrying",
    });
    tree = renderForm(hooks, lockedProps);
    await submit(tree);
    expect(onSave).not.toHaveBeenCalled();
    expect(propsOf(findSubmitButton(tree)).disabled).toBe(true);
    expect(textContent(findSubmitButton(tree))).toContain("Refresh before retrying");

    const closeButton = findElement(
      tree,
      (element) => element.type === "button" && textContent(element.props.children).trim() === "Close form",
    );
    const cancelButton = allElements(tree).find(
      (element) => element.type === Button && propsOf(element).type === "button" && textContent(element.props.children).trim() === "Cancel",
    );
    const close = propsOf(closeButton as ReactElement<ElementProps>).onClick;
    const cancel = propsOf(cancelButton as ReactElement<ElementProps>).onClick;
    if (typeof close !== "function" || typeof cancel !== "function") {
      throw new Error("Expected both cancel actions to have handlers.");
    }
    (close as () => void)();
    (cancel as () => void)();
    expect(onCancel).toHaveBeenCalledTimes(2);
  });
});
