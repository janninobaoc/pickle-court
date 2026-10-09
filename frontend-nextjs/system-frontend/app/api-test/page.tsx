
import { getCourts } from "../lib/courts-api";
import { mapApiCourt, type MappedCourt } from "../lib/court-mapper";

export const dynamic = "force-dynamic";

export default async function ApiTestPage() {
  let courts: MappedCourt[] = [];
  let errorMessage: string | null = null;

  try {
    const apiCourts = await getCourts();

    courts = apiCourts.map(mapApiCourt);
  } catch (error) {
    console.error("Court API mapping test failed:", error);
    errorMessage = "Unable to load or process courts from Laravel API.";
  }

  if (errorMessage) {
    return (
      <main className="min-h-screen bg-[#F8FAF7] p-8">
        <h1 className="text-2xl font-bold text-red-600">
          API Mapping Failed
        </h1>

        <p className="mt-3 text-gray-600">{errorMessage}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8FAF7] p-8">
      <h1 className="mb-6 text-3xl font-bold text-[#164A41]">
        Laravel Court Mapping Test
      </h1>

      <p className="mb-4">
        Total mapped courts: {courts.length}
      </p>

      <pre className="overflow-x-auto rounded-lg bg-white p-4 text-sm">
        {JSON.stringify(courts, null, 2)}
      </pre>
    </main>
  );
}
