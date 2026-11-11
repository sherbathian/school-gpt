<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FeeType;
use App\Models\School;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class FeeTypeController extends Controller
{
    public function index(Request $request, int $school): JsonResponse
    {
        $schoolRecord = $this->accessibleSchool($request, $school, 'manage');
        $validated = $request->validate([
            'academic_year' => ['sometimes', 'string', 'regex:/^\d{4}-\d{4}$/', 'max:20'],
        ]);
        $feeTypes = $schoolRecord->feeTypes()
            ->when(isset($validated['academic_year']), fn ($query) => $query->where('academic_year', $validated['academic_year']))
            ->orderBy('title')
            ->get();

        return response()->json(['data' => $feeTypes->map(fn (FeeType $feeType) => $this->feeTypeData($feeType))->values()]);
    }

    public function store(Request $request, int $school): JsonResponse
    {
        $schoolRecord = $this->accessibleSchool($request, $school, 'manage');
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:150'],
            'academic_year' => ['required', 'string', 'regex:/^\d{4}-\d{4}$/', 'max:20'],
            'amount' => ['required', 'numeric', 'gt:0', 'regex:/^\d{1,8}(\.\d{1,2})?$/'],
        ]);
        $this->validateUniqueTitle($validated['title'], $validated['academic_year'], $schoolRecord);
        $feeType = $schoolRecord->feeTypes()->create([
            'title' => $validated['title'],
            'academic_year' => $validated['academic_year'],
            'amount_cents' => $this->toCents($validated['amount']),
            'status' => 'active',
        ]);

        return response()->json(['data' => $this->feeTypeData($feeType)], 201);
    }

    public function update(Request $request, int $school, int $feeType): JsonResponse
    {
        $schoolRecord = $this->accessibleSchool($request, $school, 'manage');
        $feeTypeRecord = $schoolRecord->feeTypes()->findOrFail($feeType);
        $validated = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:150'],
            'academic_year' => ['sometimes', 'required', 'string', 'regex:/^\d{4}-\d{4}$/', 'max:20'],
            'amount' => ['sometimes', 'required', 'numeric', 'gt:0', 'regex:/^\d{1,8}(\.\d{1,2})?$/'],
            'status' => ['sometimes', Rule::in(['active', 'inactive'])],
        ]);
        $title = $validated['title'] ?? $feeTypeRecord->title;
        $academicYear = $validated['academic_year'] ?? $feeTypeRecord->academic_year;
        if ($title !== $feeTypeRecord->title || $academicYear !== $feeTypeRecord->academic_year) {
            $this->validateUniqueTitle($title, $academicYear, $schoolRecord, $feeTypeRecord->id);
        }
        if (isset($validated['amount'])) {
            $validated['amount_cents'] = $this->toCents($validated['amount']);
            unset($validated['amount']);
        }
        $feeTypeRecord->update($validated);

        return response()->json(['data' => $this->feeTypeData($feeTypeRecord)]);
    }

    public function destroy(Request $request, int $school, int $feeType): JsonResponse
    {
        $schoolRecord = $this->accessibleSchool($request, $school, 'manage');
        $feeTypeRecord = $schoolRecord->feeTypes()->findOrFail($feeType);
        $feeTypeRecord->update(['status' => 'inactive']);

        return response()->json([], 204);
    }

    private function accessibleSchool(Request $request, int $school, string $ability): School
    {
        $schools = $request->user()->isSuperAdmin() ? School::query() : $request->user()->activeSchools();
        $schoolRecord = $schools->whereKey($school)->firstOrFail();
        Gate::authorize($ability, $schoolRecord);

        return $schoolRecord;
    }

    private function validateUniqueTitle(string $title, string $academicYear, School $school, ?int $ignoreId = null): void
    {
        $query = FeeType::query()
            ->where('school_id', $school->id)
            ->where('title', $title)
            ->where('academic_year', $academicYear);
        if ($ignoreId !== null) {
            $query->where('id', '!=', $ignoreId);
        }
        if ($query->exists()) {
            throw ValidationException::withMessages([
                'title' => ['A fee item with this name already exists for this academic year.'],
            ]);
        }
    }

    private function toCents(string|int|float $amount): int
    {
        [$whole, $fraction] = array_pad(explode('.', (string) $amount, 2), 2, '');

        return ((int) $whole * 100) + (int) str_pad($fraction, 2, '0');
    }

    /** @return array<string, mixed> */
    private function feeTypeData(FeeType $feeType): array
    {
        return [
            'id' => $feeType->id,
            'title' => $feeType->title,
            'academic_year' => $feeType->academic_year,
            'amount' => number_format($feeType->amount_cents / 100, 2, '.', ''),
            'status' => $feeType->status,
        ];
    }
}
