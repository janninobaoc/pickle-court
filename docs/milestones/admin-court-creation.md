# Admin Court Creation Milestone

**Status: Complete**
**Feature:** Create courts from Admin Court Management and persist them through the Laravel API.

> **Current authentication architecture:** The Next.js frontend communicates directly with the Laravel API. Protected API requests use `Authorization: Bearer <token>`; the token is held in memory, and requests use `credentials: "omit"`. Authentication does not use the former API proxy, CSRF-cookie initialization, or cookie sessions. Laravel's normal web-route CSRF protection remains enabled. Authentication and verification details identified as historical below describe the original milestone implementation, not the current Bearer-token architecture.

## User problem and objectives

Administrators needed to add courts to the shared court catalog. The feature connects the existing Add Court editor to Laravel, reports validation and request errors, prevents duplicate submissions, and reloads the persisted list after creation. Editing and deletion are not part of this milestone.

## Implemented workflow

`AdminCourtManagement` loads the admin court list with `getAdminCourts()` and maps API records through `mapApiCourt()`. The enabled Add Court action opens `CourtEditorForm` in create mode. The form applies client-side validation, awaits its `onSave` callback, and locks repeated submissions while that callback is pending.

The create branch of `saveCourt()` builds a `CreateAdminCourtPayload` and calls `createAdminCourt()`. After a successful POST it calls `refreshCreatedCourtList()`, which fetches and maps persisted Laravel data. The editor closes and success feedback appears after the refreshed list is available. It does not add a fabricated court to local state.

Edit and Delete controls remain disabled in the management UI. Their existing local demo handlers are not part of court creation.

## Request and response contract

The frontend posts JSON to `/admin/courts` relative to the configured API base URL. The payload type is defined in `app/types/court.ts` as `CreateAdminCourtPayload`:

| Field | Type | Laravel validation |
| --- | --- | --- |
| `name` | string | Required, string, max 255 |
| `type` | `"Indoor" \| "Outdoor"` in the frontend | Required string, max 255 |
| `hourly_rate` | number | Required numeric, 0–100000, up to two decimal places |
| `status` | `"available" \| "unavailable"` | Required string in that set |
| `description` | optional string or null | Nullable string |
| `location` | optional string or null | Nullable string, max 255 |
| `amenities` | optional string array or null | Nullable list, max 20; each string max 100 |
| `opening_time`, `closing_time` | optional string or null | Nullable `HH:mm` time |
| `operating_days` | optional weekday array or null | Nullable list of distinct weekday names |
| `image` | optional string or null | Nullable string, max 255 |

The management component sends `name`, `type`, `hourly_rate`, `status`, `description`, `location`, `amenities`, `opening_time`, and `closing_time`. The editor's `operatingHours` and `artwork` values are UI-only and omitted; the form does not provide a compatible `operating_days` or image value, so those are omitted too.

Laravel's `CourtController::store()` returns HTTP 201 with a JSON body containing `status: 200` and `message: "Court created succesfully"` (the spelling is the current API text). The body does not include the created court, which is why the frontend refreshes the list.

## Current authorization and validation

The frontend calls the protected Laravel admin API directly with its in-memory Bearer token and omits browser credentials. It does not initialize a CSRF cookie or send an XSRF header. This API authentication change does not disable Laravel's normal web-route CSRF protection.

Laravel's admin court routes in `routes/api.php` are guarded by `auth:sanctum` and `can:access-admin-api`. The `access-admin-api` gate in `AppServiceProvider` permits users with the `admin` role. The admin route uses the existing `CourtController`, `CourtRequest`, `CourtService`, and `Court` model; the request validates fields and the service persists the validated attributes using the model's fillable fields and array casts.

The form validates required name, description, court type, location, positive hourly rate, opening and closing times (closing must be later), at least one amenity, and availability. Laravel remains authoritative and additionally validates the API contract. Its required fields are `name`, `type`, `hourly_rate`, and `status`; the other listed fields are nullable.

### Historical authentication implementation

At the time this milestone was implemented, `createAdminCourt()` used `fetchWithCsrf()` from `app/lib/auth-api.ts`. That helper initialized Sanctum's CSRF cookie, read the XSRF cookie, sent `X-XSRF-TOKEN`, and included session credentials. It did not retry a POST. This is historical behavior: `fetchWithCsrf()` has since been removed and these cookie/CSRF steps are not part of the current API flow.

## Current error and submission behavior

- **401:** The management component reports that authentication needs to be verified and calls the existing `refreshUser()` flow.
- **403:** It reports that the current user cannot create or manage courts.
- **419:** It follows the generic operation-error handling; it does not trigger CSRF/session-expiration handling or authentication refresh.
- **422:** `AdminCourtsApiError` carries Laravel's validated field-error map. The component maps API names such as `hourly_rate` and `opening_time` to editor fields, including indexed `amenities.*` errors, while retaining actionable messages and the entered values.
- **Other HTTP errors:** A nonblank server message is retained; malformed or non-JSON error bodies use a status-based fallback.
- **Network failure:** There is no automatic POST retry. When the POST outcome cannot be confirmed, the component blocks resubmission until a list refresh can reconcile the state.

Both the form's submission lock and the management component's in-flight guard prevent duplicate creates. Pending state is reflected in the submit button and Add Court control.

## Refresh and reconciliation

After a successful POST, the component GETs `/admin/courts` and maps the persisted records. If that GET fails after creation succeeded, the UI keeps the editor/reconciliation state, explains that the court was saved but the list did not refresh, and offers a separate refresh action. That action retries only the GET. If the POST outcome itself is uncertain, the UI also requires list reconciliation before another create can be submitted. A successful reconciliation updates the list and clears the lock.

## Historical automated verification (original milestone implementation)

The following results and coverage notes are preserved from the original milestone verification. They do not verify the current Bearer-token authentication architecture.

The completed frontend verification run reported:

- Full Vitest suite: **238 tests passed across 15 files**.
- `tests/admin-courts-api.test.ts`: **36 passed**.
- `tests/admin-court-management-components.test.tsx`: **13 passed**.
- `tests/court-editor-form.test.tsx`: **10 passed**.
- TypeScript (`npx.cmd tsc --noEmit`): passed.
- Targeted ESLint on the two production components and three related test files: passed.
- `git diff --check`: passed; Git emitted line-ending conversion notices only.

At that time, the API tests covered CSRF initialization and the protected POST, credential and header behavior, success and error contracts, malformed responses, and no-retry behavior. Component tests covered loading and retry, create payload mapping, pending/duplicate prevention, validation feedback, and POST-success/GET-refresh-failure reconciliation. Form tests covered client validation, submission, pending state, duplicate prevention, and retained values after errors.

## Historical manual browser verification (original milestone workflow)

The user reported all six browser scenarios passed for the original milestone workflow. These results do not verify the current Bearer-token authentication architecture:

1. Initial court loading.
2. Retry after a loading failure.
3. Successful court creation.
4. Persistence after reloading the page, verified against Laravel.
5. Validation feedback.
6. Duplicate-submission prevention.

These are user-reported results; Codex did not independently run browser tests.

## Limitations and follow-up

- Automated component tests use the repository's mocked React hook approach; they do not establish real DOM, accessibility, or browser behavior.
- The form does not expose operating-day or image inputs. Created courts therefore omit those optional API fields; the list mapper represents unspecified operating days accordingly.
- Edit and Delete remain unavailable in the UI. No production deployment is claimed by this milestone.

Recommended follow-up: handle Edit and Delete as separate, explicitly scoped milestones, reusing the existing admin routes only after their UI workflows and tests are authorized.
