# Admin Court Editing Milestone

**Status: Complete**

**Feature:** Edit an existing court from Admin Court Management and persist the update through Laravel.

> **Current authentication architecture:** The Next.js frontend communicates directly with the Laravel API. Protected API requests use `Authorization: Bearer <token>`; the token is held in memory, and requests use `credentials: "omit"`. Authentication does not use the former API proxy, CSRF-cookie initialization, or cookie sessions. Laravel's normal web-route CSRF protection remains enabled. Authentication and verification details identified as historical below describe the original milestone implementation, not the current Bearer-token architecture.

## Objective

Administrators can open a court in the shared editor, change its details, save the update to Laravel, and see Laravel's saved record reflected in the management list. The feature reuses the court creation form and current Bearer-token API infrastructure. Delete remains unavailable in the frontend.

## Architecture and workflow

`AdminCourtManagement` loads admin courts through `getAdminCourts()` and maps API records into the frontend `Court` shape with `mapApiCourt()`. The enabled Edit action calls `openEditForm(court)`, which sets the selected court as `editingCourt`. The existing `CourtEditorForm` receives that court as `initialCourt` and initializes its fields from the selected record.

The form validates client-side, awaits its `onSave` callback, disables submission while saving, and uses a ref lock to prevent repeated submissions. `saveCourt()` branches on `editingCourt`: the edit branch maps form values, calls `updateAdminCourt()`, maps the returned saved record, and replaces the matching row in local list state. It closes the editor and displays success feedback only after the update response is accepted and mapped. The create branch continues to use `createAdminCourt()` and its existing persisted-list refresh and reconciliation flow.

Search and filters continue to operate over the updated list. Delete stays disabled; no delete workflow was added.

## Laravel PUT contract

The frontend calls the API-relative endpoint `PUT /admin/courts/{id}` with a JSON body. Laravel exposes this through the admin courts route in `backend-laravel/system-backend/routes/api.php`, dispatches to `CourtController::update()`, validates through `CourtRequest`, and persists validated fields through `CourtService::updateCourt()` and the `Court` model.

The request payload uses `UpdateAdminCourtPayload`, currently an alias of `CreateAdminCourtPayload`:

| Frontend editor field | Laravel field | Value |
| --- | --- | --- |
| `name` | `name` | string |
| `category` | `type` | `Indoor` or `Outdoor` |
| `pricePerHour` | `hourly_rate` | number |
| `available` | `status` | `available` or `unavailable` |
| `description` | `description` | string |
| `location` | `location` | string |
| `amenities` | `amenities` | string array |
| `openingTime` | `opening_time` | `HH:mm` string |
| `closingTime` | `closing_time` | `HH:mm` string |

The UI-only `operatingHours` and `artwork` values are omitted. The current mapping also omits `operating_days` and `image`; the editor has no compatible image input, and operating days are not mapped into the update payload.

Laravel's `CourtRequest` requires `name`, `type`, `hourly_rate`, and `status`. It validates hourly rate as numeric, within the configured range and decimal precision; limits and validates amenities; and validates time format and optional operating-day values. Other detail fields are nullable. The response is HTTP 200 with `{ status, message, data }`, where `data` is the saved Court model. `updateAdminCourt()` validates the response shape, including the court fields, before returning the typed `UpdateAdminCourtResponse`.

## Current authentication and authorization

`updateAdminCourt()` sends the protected request directly to Laravel with the in-memory Bearer token and omits browser credentials. It does not initialize a CSRF cookie or send an XSRF header. This API authentication change does not disable Laravel's normal web-route CSRF protection.

Laravel's admin route group applies `auth:sanctum` and `can:access-admin-api`. `AppServiceProvider` defines that gate to allow users with the `admin` role. Frontend role checks are not the authorization boundary; Laravel remains authoritative. The backend authorization feature tests include PUT coverage for guests, customers, unexpected roles, and administrators. They were inspected for this milestone but were not executed.

### Historical authentication implementation

At the time this milestone was implemented, `updateAdminCourt()` used `fetchWithCsrf()` from `app/lib/auth-api.ts`. The helper initialized the Sanctum CSRF cookie, sent `X-XSRF-TOKEN`, included session credentials, and made a single protected request without automatically retrying the PUT. This is historical behavior: `fetchWithCsrf()` has since been removed and these cookie/CSRF steps are not part of the current API flow.

## Validation and error handling

The editor validates required name, description, court type, location, positive hourly rate, opening and closing times, closing time after opening, at least one amenity, and an availability choice. Laravel validation remains authoritative.

`AdminCourtsApiError` retains HTTP status, the server message (or a useful fallback), and validated Laravel field errors. The management component maps API fields such as `hourly_rate`, `type`, `status`, and `opening_time` to editor fields. Indexed `amenities.*` errors are associated with the amenities control.

- **401:** Shows neutral authentication-verification feedback and invokes the existing `refreshUser()` authentication refresh.
- **403:** Shows administrator permission feedback.
- **419:** Uses generic operation-error feedback; it does not trigger CSRF/session-expiration handling or authentication refresh.
- **422:** Retains Laravel validation messages and field-specific feedback; the editor and entered values remain available for correction.
- **Other HTTP failures:** Shows the API error message.
- **Network or request failure:** Shows an update error and keeps the editor open. No automatic PUT retry occurs; because a network failure can leave the result uncertain, the UI advises reviewing the court list before trying again.

Both `CourtEditorForm`'s submit lock and the management component's update in-flight ref prevent duplicate update calls. The pending state is reflected in the form, and other Edit controls are disabled while an editor or save is active.

## Historical automated verification (original milestone implementation)

The following results and coverage notes are preserved from the original milestone verification. They do not verify the current Bearer-token authentication architecture.

The reported frontend verification results are:

- Full Vitest suite: **264 tests passed across 15 files**.
- `tests/admin-courts-api.test.ts`: **54 tests passed**. At that time, coverage included update request method/path, Sanctum CSRF initialization, credential and header behavior, response parsing, validation/error responses, and no automatic PUT retry.
- `tests/admin-court-management-components.test.tsx`: **21 tests passed**. Coverage includes Edit availability and opening, prefilled values, form-to-API mapping, use of the Laravel response to replace the selected list row, pending/duplicate submission, HTTP and network errors, preserved values, Add Court, and disabled Delete.
- `npx.cmd tsc --noEmit`: passed.
- Targeted ESLint on the relevant production components and API/component tests: passed.
- `git diff --check`: passed.

These are automated repository verification results. The frontend component tests use mocked React hooks and API helpers; they exercise component handlers and state transitions, but do not provide real DOM or browser interaction coverage.

## Historical browser verification (original milestone workflow)

The user reported that all **8 browser verification scenarios** passed for the original milestone workflow, including persistence after reloading the page. This is user-reported browser evidence; Codex did not independently run those browser scenarios. These results do not verify the current Bearer-token authentication architecture.

## Limitations and follow-up

- Backend authorization tests were inspected but not executed. No backend test result is claimed here.
- Hook-mocked component tests do not validate visual layout, browser accessibility, or real keyboard and pointer interaction.
- Delete remains disabled in the management interface. Its existing Laravel endpoint is outside this editing milestone.
- The form does not expose image or operating-day editing through this update flow.
- No production deployment is claimed.

Recommended follow-up: run the backend admin court authorization feature tests in the guarded test environment, then treat Delete as a separate implementation milestone if requested.

## Related milestone

See [Admin Court Creation](admin-court-creation.md) for the shared editor, create workflow, and create-list reconciliation details.
