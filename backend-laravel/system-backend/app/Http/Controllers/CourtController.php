<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Http\Requests\CourtRequest;
use App\Http\Requests\CourtAvailabilityRequest;
use App\Models\Court;
use App\Services\CourtService;
use App\Services\CourtAvailabilityService;
use Symfony\Component\HttpFoundation\File\Exception\NoTmpDirFileException;
use Symfony\Component\HttpFoundation\Response;
use Illuminate\Http\Request;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\JsonResponse;

class CourtController extends Controller
{
    protected CourtService $courtService;
    protected CourtAvailabilityService $courtAvailabilityService;

    public function __construct(CourtService $courtService, CourtAvailabilityService $courtAvailabilityService)
    {
        $this->courtService = $courtService;
        $this->courtAvailabilityService = $courtAvailabilityService;
    }

    public function index(Request $request)
    {
        try {
            $courts = $this->courtService->getAllCourts();

            return response()->json(
                $courts,
                Response::HTTP_OK
            );
        } catch (\Throwable $e) {
            report($e);

            return response()->json([
                'message' => 'An unexpected error occurred.'
            ], 500);
        }
    }
    public function show(int $id)
    {
        try {
            $court = $this->courtService->getCourtById($id);
            return response()->json($court, Response::HTTP_OK);
        } catch (ModelNotFoundException $e) {
            return response()->json([
                'message' => 'Court not found.'
            ], 404);

        } catch (\Throwable $e) {
            report($e);

            return response()->json([
                'message' => 'An unexpected error occurred.'
            ], 500);
        }
    }

    public function availability(int $id, CourtAvailabilityRequest $request)
    {
        try {
            return response()->json([
                'status' => Response::HTTP_OK,
                'data' => $this->courtAvailabilityService->forDate($id, $request->validated('date')),
            ], Response::HTTP_OK);
        } catch (ModelNotFoundException $e) {
            return response()->json([
                'message' => 'Court not found.',
            ], Response::HTTP_NOT_FOUND);
        } catch (\Throwable $e) {
            report($e);

            return response()->json([
                'message' => 'Unable to retrieve court availability.',
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }
    public function store(CourtRequest $request)
    {
        try {
            $courtData = $request->validated();

            $court = $this->courtService->createCourt($courtData);

            if ($court) {
                return response()->json([
                    'status' => 200,
                    'message' => 'Court created succesfully'
                ], Response::HTTP_CREATED);
            } else {
                return response()->json([
                    'status' => 500,
                    'message' => 'Court creation failed'
                ], Response::HTTP_INTERNAL_SERVER_ERROR);
            }
        } catch (\Throwable $e) {
            report($e);

            return response()->json([
                'message' => 'An unexpected error occurred.'
            ], 500);
        }
    }
    public function update(CourtRequest $request, Court $court)
    {
        try {
            $courtData = $request->validated();

            $court = $this->courtService->updateCourt($court, $courtData);

            return response()->json([
                'status' => 200,
                'message' => 'Court updated successfully',
                'data' => $court
            ], Response::HTTP_OK);
        } catch (\Throwable $e) {
            report($e);

            return response()->json([
                'message' => 'An unexpected error occurred.'
            ], 500);
        }
    }
    public function destroy(int $id)
    {
        try {
            $court = Court::findOrFail($id);

            $this->courtService->deleteCourt($court);

            return response()->json([
                'message' => 'Court deleted succesfully'
            ]);
        } catch (ModelNotFoundException $e) {
            return response()->json([
                'message' => 'Court not found.'
            ], 404);

        } catch (\Throwable $e) {
            report($e);

            return response()->json([
                'message' => 'An unexpected error occurred.'
            ], 500);
        }
    }
}
