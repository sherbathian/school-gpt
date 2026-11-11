<?php

use App\Http\Controllers\Api\AttendanceController;
use App\Http\Controllers\Api\FeeInvoiceController;
use App\Http\Controllers\Api\FeeTypeController;
use App\Http\Controllers\Api\GradeController;
use App\Http\Controllers\Api\SectionController;
use App\Http\Controllers\Api\SchoolSessionController;
use App\Http\Controllers\Api\StudentController;
use App\Http\Controllers\Api\SubjectController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\HealthController;
use App\Http\Controllers\SchoolController;
use App\Http\Controllers\SchoolUserController;
use Illuminate\Support\Facades\Route;

Route::get('/health', HealthController::class);

Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:6,1');

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::get('/schools', [SchoolController::class, 'index']);
    Route::post('/schools', [SchoolController::class, 'store']);
    Route::get('/schools/{school}', [SchoolController::class, 'show']);
    Route::patch('/schools/{school}', [SchoolController::class, 'update']);
    Route::delete('/schools/{school}', [SchoolController::class, 'destroy']);
    Route::get('/schools/{school}/users', [SchoolUserController::class, 'index']);
    Route::post('/schools/{school}/users', [SchoolUserController::class, 'store']);
    Route::patch('/schools/{school}/users/{user}', [SchoolUserController::class, 'update']);
    Route::delete('/schools/{school}/users/{user}', [SchoolUserController::class, 'destroy']);
    Route::apiResource('schools.grades', GradeController::class);
    Route::apiResource('schools.sessions', SchoolSessionController::class);
    Route::put('/schools/{school}/grades/{grade}/sections', [GradeController::class, 'syncSections']);
    Route::apiResource('schools.sections', SectionController::class);
    Route::apiResource('schools.subjects', SubjectController::class);
    Route::apiResource('schools.students', StudentController::class);
    Route::post('/schools/{school}/students/{student}/enrollments', [StudentController::class, 'enroll']);
    Route::get('/schools/{school}/attendance', [AttendanceController::class, 'index']);
    Route::put('/schools/{school}/attendance', [AttendanceController::class, 'update']);
    Route::get('/schools/{school}/fee-types', [FeeTypeController::class, 'index']);
    Route::post('/schools/{school}/fee-types', [FeeTypeController::class, 'store']);
    Route::patch('/schools/{school}/fee-types/{feeType}', [FeeTypeController::class, 'update']);
    Route::delete('/schools/{school}/fee-types/{feeType}', [FeeTypeController::class, 'destroy']);
    Route::get('/schools/{school}/fee-invoices', [FeeInvoiceController::class, 'index']);
    Route::post('/schools/{school}/fee-invoices', [FeeInvoiceController::class, 'store']);
    Route::delete('/schools/{school}/fee-invoices/{feeInvoice}', [FeeInvoiceController::class, 'destroy']);
    Route::post('/schools/{school}/fee-invoices/{feeInvoice}/payments', [FeeInvoiceController::class, 'recordPayment']);
});
