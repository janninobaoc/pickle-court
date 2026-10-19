"use client";

import { useRef, useState, type FormEvent } from "react";
import type { Court } from "../data/courts";
import { formatTime } from "../lib/booking-utils";
import Button from "./button";

const amenityOptions = [
  "Parking",
  "Restrooms",
  "Lighting",
  "Seating",
  "Equipment rental",
  "Air-conditioned",
  "Changing rooms",
  "Water station",
  "Open-air",
  "Pro surface",
  "Spectator seating",
  "Cafe nearby",
];

type CourtFormValues = {
  name: string;
  description: string;
  category: "Indoor" | "Outdoor" | "";
  location: string;
  pricePerHour: string;
  openingTime: string;
  closingTime: string;
  amenities: string[];
  available: "true" | "false" | "";
};

type CourtChanges = Omit<Court, "id">;
export type CourtEditorFieldErrors = Partial<Record<keyof CourtFormValues, string>>;

type CourtEditorFormProps = {
  initialCourt: Court | null;
  onSave: (changes: CourtChanges) => void | Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
  isSubmitLocked?: boolean;
  submitLockedLabel?: string;
  submitPendingLabel?: string;
  submissionError?: string | null;
  serverFieldErrors?: CourtEditorFieldErrors;
};

const fieldStyles =
  "mt-1.5 min-h-11 w-full rounded-xl border border-border bg-white px-3.5 text-sm text-foreground outline-none transition hover:border-primary/30 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20";

function initialValues(court: Court | null): CourtFormValues {
  if (!court) {
    return {
      name: "",
      description: "",
      category: "",
      location: "",
      pricePerHour: "",
      openingTime: "",
      closingTime: "",
      amenities: [],
      available: "",
    };
  }

  return {
    name: court.name,
    description: court.description,
    category: court.category,
    location: court.location,
    pricePerHour: String(court.pricePerHour),
    openingTime: court.openingTime,
    closingTime: court.closingTime,
    amenities: [...court.amenities],
    available: String(court.available) as "true" | "false",
  };
}

function validate(values: CourtFormValues): CourtEditorFieldErrors {
  const errors: CourtEditorFieldErrors = {};
  if (!values.name.trim()) errors.name = "Court name is required.";
  if (!values.description.trim()) errors.description = "Description is required.";
  if (!values.category) errors.category = "Select a court type.";
  if (!values.location.trim()) errors.location = "Location is required.";
  const rate = Number(values.pricePerHour);
  if (!values.pricePerHour || !Number.isFinite(rate) || rate <= 0) {
    errors.pricePerHour = "Enter an hourly rate greater than zero.";
  }
  if (!values.openingTime) errors.openingTime = "Opening time is required.";
  if (!values.closingTime) errors.closingTime = "Closing time is required.";
  if (values.openingTime && values.closingTime && values.closingTime <= values.openingTime) {
    errors.closingTime = "Closing time must be later than opening time.";
  }
  if (values.amenities.length === 0) errors.amenities = "Select at least one amenity.";
  if (!values.available) errors.available = "Select an availability status.";
  return errors;
}

export default function CourtEditorForm({
  initialCourt,
  onSave,
  onCancel,
  isSubmitting = false,
  isSubmitLocked = false,
  submitLockedLabel = "Court saved",
  submitPendingLabel = "Saving court...",
  submissionError,
  serverFieldErrors = {},
}: CourtEditorFormProps) {
  const [values, setValues] = useState(() => initialValues(initialCourt));
  const [errors, setErrors] = useState<CourtEditorFieldErrors>({});
  const [clearedServerErrors, setClearedServerErrors] = useState<Partial<Record<keyof CourtFormValues, boolean>>>({});
  const submissionLockRef = useRef(false);

  function updateField<Key extends keyof CourtFormValues>(field: Key, value: CourtFormValues[Key]) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setClearedServerErrors((current) => ({ ...current, [field]: true }));
  }

  function toggleAmenity(amenity: string) {
    const nextAmenities = values.amenities.includes(amenity)
      ? values.amenities.filter((item) => item !== amenity)
      : [...values.amenities, amenity];
    updateField("amenities", nextAmenities);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting || isSubmitLocked || submissionLockRef.current) return;

    const validationErrors = validate(values);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    const category = values.category as "Indoor" | "Outdoor";
    const openingTime = values.openingTime;
    const closingTime = values.closingTime;
    setClearedServerErrors({});
    submissionLockRef.current = true;

    try {
      await onSave({
        name: values.name.trim(),
        description: values.description.trim(),
        category,
        location: values.location.trim(),
        pricePerHour: Number(values.pricePerHour),
        operatingHours: `Daily, ${formatTime(openingTime)} - ${formatTime(closingTime)}`,
        openingTime,
        closingTime,
        operatingDays: initialCourt?.operatingDays,
        amenities: [...values.amenities],
        artwork: category === "Indoor" ? "indoor" : "outdoor",
        available: values.available === "true",
      });
    } finally {
      submissionLockRef.current = false;
    }
  }

  function getFieldError(field: keyof CourtFormValues) {
    return errors[field] ?? (clearedServerErrors[field] ? undefined : serverFieldErrors[field]);
  }

  function fieldError(field: keyof CourtFormValues) {
    const id = `court-${field}-error`;
    const message = getFieldError(field);
    return message ? <p id={id} role="alert" className="mt-1.5 text-xs font-medium text-red-700">{message}</p> : null;
  }

  return (
    <section aria-labelledby="court-editor-title" className="rounded-2xl border border-primary/15 bg-white p-5 shadow-soft sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">{initialCourt ? "Demo action" : "Admin action"}</p>
          <h2 id="court-editor-title" className="mt-1 text-xl font-bold text-foreground">{initialCourt ? "Edit Court" : "Add Court"}</h2>
          <p className="mt-1 text-sm text-muted">
            {initialCourt
              ? "Changes apply to this page only and are not saved."
              : "New courts are saved to the shared court listings."}
          </p>
        </div>
        <button type="button" onClick={onCancel} disabled={isSubmitting} className="min-h-10 rounded-lg px-3 text-sm font-semibold text-muted hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50">
          Close form
        </button>
      </div>

      <form noValidate onSubmit={handleSubmit} aria-busy={isSubmitting || undefined} className="mt-6 grid gap-4 sm:grid-cols-2">
        {submissionError && (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 sm:col-span-2">
            {submissionError}
          </p>
        )}
        <div>
          <label htmlFor="court-name" className="text-sm font-semibold text-foreground">Court Name</label>
          <input id="court-name" required aria-required="true" value={values.name} onChange={(event) => updateField("name", event.target.value)} aria-invalid={Boolean(getFieldError("name"))} aria-describedby={getFieldError("name") ? "court-name-error" : undefined} className={fieldStyles} />
          {fieldError("name")}
        </div>
        <div>
          <label htmlFor="court-location" className="text-sm font-semibold text-foreground">Location</label>
          <input id="court-location" required aria-required="true" value={values.location} onChange={(event) => updateField("location", event.target.value)} aria-invalid={Boolean(getFieldError("location"))} aria-describedby={getFieldError("location") ? "court-location-error" : undefined} className={fieldStyles} />
          {fieldError("location")}
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="court-description" className="text-sm font-semibold text-foreground">Description</label>
          <textarea id="court-description" rows={3} required aria-required="true" value={values.description} onChange={(event) => updateField("description", event.target.value)} aria-invalid={Boolean(getFieldError("description"))} aria-describedby={getFieldError("description") ? "court-description-error" : undefined} className={`${fieldStyles} py-3`} />
          {fieldError("description")}
        </div>
        <div>
          <label htmlFor="court-type" className="text-sm font-semibold text-foreground">Type</label>
          <select id="court-type" required aria-required="true" value={values.category} onChange={(event) => updateField("category", event.target.value as CourtFormValues["category"])} aria-invalid={Boolean(getFieldError("category"))} aria-describedby={getFieldError("category") ? "court-category-error" : undefined} className={fieldStyles}>
            <option value="">Select type</option>
            <option value="Indoor">Indoor</option>
            <option value="Outdoor">Outdoor</option>
          </select>
          {fieldError("category")}
        </div>
        <div>
          <label htmlFor="court-rate" className="text-sm font-semibold text-foreground">Hourly Rate (PHP)</label>
          <input id="court-rate" type="number" required aria-required="true" min="0.01" step="0.01" inputMode="decimal" value={values.pricePerHour} onChange={(event) => updateField("pricePerHour", event.target.value)} aria-invalid={Boolean(getFieldError("pricePerHour"))} aria-describedby={getFieldError("pricePerHour") ? "court-pricePerHour-error" : undefined} className={fieldStyles} />
          {fieldError("pricePerHour")}
        </div>
        <div>
          <label htmlFor="court-opening-time" className="text-sm font-semibold text-foreground">Opening Time</label>
          <input id="court-opening-time" type="time" required aria-required="true" value={values.openingTime} onChange={(event) => updateField("openingTime", event.target.value)} aria-invalid={Boolean(getFieldError("openingTime"))} aria-describedby={getFieldError("openingTime") ? "court-openingTime-error" : undefined} className={fieldStyles} />
          {fieldError("openingTime")}
        </div>
        <div>
          <label htmlFor="court-closing-time" className="text-sm font-semibold text-foreground">Closing Time</label>
          <input id="court-closing-time" type="time" required aria-required="true" value={values.closingTime} onChange={(event) => updateField("closingTime", event.target.value)} aria-invalid={Boolean(getFieldError("closingTime"))} aria-describedby={getFieldError("closingTime") ? "court-closingTime-error" : undefined} className={fieldStyles} />
          {fieldError("closingTime")}
        </div>
        <div className="sm:col-span-2">
          <fieldset aria-required="true" aria-describedby={getFieldError("amenities") ? "court-amenities-error" : undefined}>
            <legend className="text-sm font-semibold text-foreground">Amenities</legend>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {amenityOptions.map((amenity) => (
                <label key={amenity} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs text-foreground hover:bg-background focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary sm:text-sm">
                  <input type="checkbox" checked={values.amenities.includes(amenity)} onChange={() => toggleAmenity(amenity)} className="size-4 rounded accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" />
                  {amenity}
                </label>
              ))}
            </div>
            {fieldError("amenities")}
          </fieldset>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="court-status" className="text-sm font-semibold text-foreground">Availability Status</label>
          <select id="court-status" required aria-required="true" value={values.available} onChange={(event) => updateField("available", event.target.value as CourtFormValues["available"])} aria-invalid={Boolean(getFieldError("available"))} aria-describedby={getFieldError("available") ? "court-available-error" : undefined} className={fieldStyles}>
            <option value="">Select status</option>
            <option value="true">Available</option>
            <option value="false">Unavailable</option>
          </select>
          {fieldError("available")}
        </div>
        <div className="flex flex-col gap-3 pt-2 sm:col-span-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting}>Cancel</Button>
          <Button type="submit" disabled={isSubmitting || isSubmitLocked}>
            {isSubmitting
              ? submitPendingLabel
              : isSubmitLocked
                ? submitLockedLabel
                : initialCourt
                  ? "Save Changes"
                  : "Add Court"}
          </Button>
        </div>
      </form>
    </section>
  );
}
