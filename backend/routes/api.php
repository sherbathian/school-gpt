<?php

use App\Http\Controllers\Api\GradeController;
use App\Http\Controllers\Api\SectionController;
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
    Route::put('/schools/{school}/grades/{grade}/sections', [GradeController::class, 'syncSections']);
    Route::apiResource('schools.sections', SectionController::class);
    Route::apiResource('schools.subjects', SubjectController::class);
});
