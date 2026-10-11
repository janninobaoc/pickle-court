<?php

namespace App\Http\Controllers;

use App\Http\Requests\BookingRequest;
use App\Http\Requests\RescheduleBookingRequest;
use Illuminate\Http\Request;
use App\Services\BookingService;
use Symfony\Component\HttpFoundation\Response;

class BookingController extends Controller
{
    protected BookingService $bookingService;

    public function __construct(BookingService $bookingService)
    {
        $this->bookingService = $bookingService;
    }

    public function index(Request $request)
    {
        try {
            $bookings = $this->bookingService->getAllBookings($request->user()->id);

            return response()->json([
                'status' => Response::HTTP_OK,
                'data' => $bookings
            ], Response::HTTP_OK);
        } catch (\Throwable $e) {
            report($e);

            return response()->json([
                'message' => 'Unable to retrieve bookings.',
            ], 500);
        }
    }

    public function show(int $id, Request $request)
    {
        // try {
        $booking = $this->bookingService->getBookingById($id, $request->user()->id);

        return response()->json([
            'status' => Response::HTTP_OK,
            'data' => $booking
        ], Response::HTTP_OK);

        // } catch (\Exception $e) {
        //     return response()->json([
        //         'error' => $e->getMessage()
        //     ], Response::HTTP_INTERNAL_SERVER_ERROR);
        // }
    }

    public function store(BookingRequest $request)
    {
        try {
            $bookingData = $request->validated();

            $booking = $this->bookingService->createBooking(
                $bookingData,
                $request->user()->id
            );

            return response()->json([
                'status' => 200,
                'message' => 'Booking created successfully',
                'data' => $booking
            ], Response::HTTP_CREATED);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'message' => 'Court not found.'
            ], 404);

        } catch (\DomainException $e) {
            return response()->json([
                'message' => $e->getMessage()
            ], 409);

        } catch (\Throwable $e) {
            report($e);

            return response()->json([
                'message' => 'Unable to process your booking at this time.'
            ], 500);
        }
    }

    public function destroy(int $id, Request $request)
    {
        try {
            $booking = $this->bookingService->cancelBooking(
                $id,
                $request->user()->id
            );

            return response()->json([
                'status' => Response::HTTP_OK,
                'message' => 'Booking cancelled successfully',
                'data' => $booking,
            ], Response::HTTP_OK);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'message' => 'Booking not found.',
            ], Response::HTTP_NOT_FOUND);
        } catch (\DomainException $e) {
            return response()->json([
                'message' => $e->getMessage(),
            ], Response::HTTP_CONFLICT);
        } catch (\Throwable $e) {
            report($e);

            return response()->json([
                'message' => 'Unable to cancel this booking at this time.',
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    public function reschedule(int $id, RescheduleBookingRequest $request)
    {
        try {
            $booking = $this->bookingService->rescheduleBooking(
                $id,
                $request->user()->id,
                $request->validated()
            );

            return response()->json([
                'status' => Response::HTTP_OK,
                'message' => 'Booking rescheduled successfully',
                'data' => $booking,
            ], Response::HTTP_OK);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'message' => 'Booking not found.',
            ], Response::HTTP_NOT_FOUND);
        } catch (\DomainException $e) {
            return response()->json([
                'message' => $e->getMessage(),
            ], Response::HTTP_CONFLICT);
        } catch (\Throwable $e) {
            report($e);

            return response()->json([
                'message' => 'Unable to reschedule this booking at this time.',
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }
}
