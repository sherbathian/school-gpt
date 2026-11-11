<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Enrollment;
use App\Models\School;
use App\Models\Student;
use Carbon\CarbonImmutable;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class StudentController extends Controller
{
    public function index(Request $request, int $school): JsonResponse
    {
        $schoolRecord = $this->accessibleSchool($request, $school, 'view');
        $validated = $request->validate([
            'academic_year' => ['sometimes', 'string', 'regex:/^\d{4}-\d{4}$/', 'max:20'],
        ]);
        $studentsQuery = $schoolRecord->students()
            ->with('enrollments.grade:id,title', 'enrollments.section:id,title')
            ->orderBy('last_name')
            ->orderBy('first_name');

        if (isset($validated['academic_year'])) {
            $studentsQuery->whereHas('enrollments', fn ($query) => $query->where('academic_year', $validated['academic_year']));
        }

        $students = $studentsQuery->get();

        return response()->json(['data' => $students->map(fn (Student $student) => $this->studentData($student))->values()]);
    }

    public function store(Request $request, int $school): JsonResponse
    {
        $schoolRecord = $this->accessibleSchool($request, $school, 'manage');
        $validated = $request->validate([
            'admission_number' => ['required', 'string', 'max:50', Rule::unique('students', 'admission_number')->where(fn (Builder $query) => $query->where('school_id', $schoolRecord->id))],
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
        ]);
        $student = $schoolRecord->students()->create($validated);

        return response()->json(['data' => $this->studentData($student->load('enrollments.grade:id,title', 'enrollments.section:id,title'))], 201);
    }

    public function show(Request $request, int $school, int $student): JsonResponse
    {
        $schoolRecord = $this->accessibleSchool($request, $school, 'view');
        $studentRecord = $schoolRecord->students()->with('enrollments.grade:id,title', 'enrollments.section:id,title')->findOrFail($student);

        return response()->json(['data' => $this->studentData($studentRecord)]);
    }

    public function update(Request $request, int $school, int $student): JsonResponse
    {
        $schoolRecord = $this->accessibleSchool($request, $school, 'manage');
        $studentRecord = $schoolRecord->students()->findOrFail($student);
        $validated = $request->validate([
            'admission_number' => ['sometimes', 'required', 'string', 'max:50', Rule::unique('students', 'admission_number')->where(fn (Builder $query) => $query->where('school_id', $schoolRecord->id))->ignore($studentRecord->id)],
            'first_name' => ['sometimes', 'required', 'string', 'max:100'],
            'last_name' => ['sometimes', 'required', 'string', 'max:100'],
            'status' => ['sometimes', Rule::in(['active', 'inactive'])],
        ]);
        $studentRecord->update($validated);

        return response()->json(['data' => $this->studentData($studentRecord->load('enrollments.grade:id,title', 'enrollments.section:id,title'))]);
    }

    public function destroy(Request $request, int $school, int $student): JsonResponse
    {
        $schoolRecord = $this->accessibleSchool($request, $school, 'manage');
        $studentRecord = $schoolRecord->students()->findOrFail($student);
        $studentRecord->update(['status' => 'inactive']);
        $studentRecord->enrollments()->where('status', 'active')->update(['status' => 'withdrawn', 'ended_on' => now()->toDateString()]);

        return response()->json([], 204);
    }

    public function enroll(Request $request, int $school, int $student): JsonResponse
    {
        $schoolRecord = $this->accessibleSchool($request, $school, 'manage');
        $studentRecord = $schoolRecord->students()->where('status', 'active')->findOrFail($student);
        $validated = $request->validate([
            'grade_id' => ['required', 'integer'],
            'section_id' => ['required', 'integer'],
            'academic_year' => ['required', 'string', 'regex:/^\d{4}-\d{4}$/', 'max:20'],
            'enrolled_on' => ['sometimes', 'date'],
        ]);
        $gradeId = (int) $validated['grade_id'];
        $sectionId = (int) $validated['section_id'];
        $enrolledOn = $validated['enrolled_on'] ?? now()->toDateString();
        $previousEnrollmentEndDate = CarbonImmutable::parse($enrolledOn)->subDay()->toDateString();
        $isAssignedActiveClass = DB::table('grade_section')
            ->join('grades', function ($join) {
                $join->on('grades.id', '=', 'grade_section.grade_id')
                    ->on('grades.school_id', '=', 'grade_section.school_id');
            })
            ->join('sections', function ($join) {
                $join->on('sections.id', '=', 'grade_section.section_id')
                    ->on('sections.school_id', '=', 'grade_section.school_id');
            })
            ->where('grade_section.school_id', $schoolRecord->id)
            ->where('grade_section.grade_id', $gradeId)
            ->where('grade_section.section_id', $sectionId)
            ->where('grades.status', 'active')
            ->where('sections.status', 'active')
            ->exists();

        if (! $isAssignedActiveClass) {
            throw ValidationException::withMessages([
                'section_id' => ['Choose an active section assigned to the selected grade in this school.'],
            ]);
        }

        $enrollment = DB::transaction(function () use ($studentRecord, $schoolRecord, $validated, $gradeId, $sectionId, $enrolledOn, $previousEnrollmentEndDate): Enrollment {
            $studentRecord = Student::query()->whereKey($studentRecord->id)->lockForUpdate()->firstOrFail();
            $studentRecord->enrollments()
                ->where('status', 'active')
                ->update(['status' => 'completed', 'ended_on' => $previousEnrollmentEndDate]);

            return $studentRecord->enrollments()->create([
                'school_id' => $schoolRecord->id,
                'grade_id' => $gradeId,
                'section_id' => $sectionId,
                'academic_year' => $validated['academic_year'],
                'status' => 'active',
                'enrolled_on' => $enrolledOn,
            ])->load('grade:id,title', 'section:id,title');
        });

        return response()->json(['data' => $this->enrollmentData($enrollment)], 201);
    }

    private function accessibleSchool(Request $request, int $school, string $ability): School
    {
        $schools = $request->user()->isSuperAdmin() ? School::query() : $request->user()->activeSchools();
        $schoolRecord = $schools->whereKey($school)->firstOrFail();
        Gate::authorize($ability, $schoolRecord);

        return $schoolRecord;
    }

    /** @return array<string, mixed> */
    private function studentData(Student $student): array
    {
        $enrollments = $student->enrollments->sortByDesc('id')->values();
        $currentEnrollment = $enrollments->firstWhere('status', 'active');

        return [
            'id' => $student->id,
            'admission_number' => $student->admission_number,
            'first_name' => $student->first_name,
            'last_name' => $student->last_name,
            'status' => $student->status,
            'current_enrollment' => $currentEnrollment ? $this->enrollmentData($currentEnrollment) : null,
            'enrollments' => $enrollments->map(fn (Enrollment $enrollment) => $this->enrollmentData($enrollment))->all(),
        ];
    }

    /** @return array<string, mixed> */
    private function enrollmentData(Enrollment $enrollment): array
    {
        return [
            'id' => $enrollment->id,
            'academic_year' => $enrollment->academic_year,
            'status' => $enrollment->status,
            'enrolled_on' => $enrollment->enrolled_on->toDateString(),
            'ended_on' => $enrollment->ended_on?->toDateString(),
            'grade' => ['id' => $enrollment->grade->id, 'title' => $enrollment->grade->title],
            'section' => ['id' => $enrollment->section->id, 'title' => $enrollment->section->title],
        ];
    }
}
