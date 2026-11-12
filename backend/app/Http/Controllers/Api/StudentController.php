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
            'gender' => ['nullable', Rule::in(['male', 'female'])], 'religion' => ['nullable', 'string', 'max:100'],
            'email' => ['nullable', 'email', 'max:255'], 'phone' => ['nullable', 'string', 'max:50'], 'address' => ['nullable', 'string'],
            'birth_date' => ['nullable', 'date'], 'admission_date' => ['nullable', 'date'], 'leave_date' => ['nullable', 'date'],
            'status' => ['sometimes', Rule::in(['pending', 'active', 'leave', 'alumni', 'inactive'])],
            'b_form_number' => ['nullable', 'string', 'max:15', Rule::unique('students', 'b_form_number')->where(fn (Builder $query) => $query->where('school_id', $schoolRecord->id))],
            'previous_school_details' => ['nullable', 'string'], 'note' => ['nullable', 'string'],
            'photo' => ['nullable', 'image', 'max:5120'], 'b_form_document' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:5120'],
            'guardian' => ['nullable', 'array'], 'guardian.father_name' => ['nullable', 'string', 'max:255'], 'guardian.father_phone' => ['nullable', 'string', 'max:50'], 'guardian.father_occupation' => ['nullable', 'string', 'max:255'], 'guardian.father_cnic' => ['nullable', 'string', 'max:30'],
            'guardian.mother_name' => ['nullable', 'string', 'max:255'], 'guardian.mother_phone' => ['nullable', 'string', 'max:50'], 'guardian.mother_occupation' => ['nullable', 'string', 'max:255'], 'guardian.mother_cnic' => ['nullable', 'string', 'max:30'],
            'guardian.is_guardian_other' => ['nullable', 'boolean'], 'guardian.guardian_name' => ['nullable', 'string', 'max:255'], 'guardian.guardian_relation' => ['nullable', 'string', 'max:100'], 'guardian.guardian_email' => ['nullable', 'email', 'max:255'], 'guardian.guardian_phone' => ['nullable', 'string', 'max:50'], 'guardian.guardian_occupation' => ['nullable', 'string', 'max:255'], 'guardian.guardian_cnic' => ['nullable', 'string', 'max:30'], 'guardian.guardian_address' => ['nullable', 'string'],
        ]);
        $guardian = $validated['guardian'] ?? null;
        unset($validated['guardian']);
        $photo = $validated['photo'] ?? null;
        $bFormDocument = $validated['b_form_document'] ?? null;
        unset($validated['photo'], $validated['b_form_document']);
        if ($photo) {
            $validated['photo_path'] = $photo->store("students/{$schoolRecord->id}/photos", 'local');
        }
        if ($bFormDocument) {
            $validated['b_form_document_path'] = $bFormDocument->store("students/{$schoolRecord->id}/documents", 'local');
        }
        if ($guardian && collect($guardian)->filter()->isNotEmpty()) {
            if (! ($guardian['is_guardian_other'] ?? false) && empty($guardian['father_phone']) && empty($guardian['mother_phone'])) {
                throw ValidationException::withMessages(['guardian.father_phone' => ['Enter a father, mother, or other guardian phone number.']]);
            }
            if (($guardian['is_guardian_other'] ?? false) && (empty($guardian['guardian_name']) || empty($guardian['guardian_relation']) || empty($guardian['guardian_phone']))) {
                throw ValidationException::withMessages(['guardian.guardian_name' => ['Name, relation, and phone are required for an alternate guardian.']]);
            }
        }
        $student = DB::transaction(function () use ($schoolRecord, $validated, $guardian) {
            if ($guardian && collect($guardian)->filter()->isNotEmpty()) {
                $validated['guardian_id'] = $schoolRecord->guardians()->create($guardian)->id;
            }

            return $schoolRecord->students()->create($validated);
        });

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
            'status' => ['sometimes', Rule::in(['pending', 'active', 'leave', 'alumni', 'inactive'])],
            'gender' => ['sometimes', 'nullable', Rule::in(['male', 'female'])], 'religion' => ['sometimes', 'nullable', 'string', 'max:100'],
            'email' => ['sometimes', 'nullable', 'email', 'max:255'], 'phone' => ['sometimes', 'nullable', 'string', 'max:50'], 'address' => ['sometimes', 'nullable', 'string'],
            'birth_date' => ['sometimes', 'nullable', 'date'], 'admission_date' => ['sometimes', 'nullable', 'date'], 'leave_date' => ['sometimes', 'nullable', 'date'],
            'b_form_number' => ['sometimes', 'nullable', 'string', 'max:15', Rule::unique('students', 'b_form_number')->where(fn (Builder $query) => $query->where('school_id', $schoolRecord->id))->ignore($studentRecord->id)],
            'previous_school_details' => ['sometimes', 'nullable', 'string'], 'note' => ['sometimes', 'nullable', 'string'],
            'photo' => ['sometimes', 'nullable', 'image', 'max:5120'], 'b_form_document' => ['sometimes', 'nullable', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:5120'],
            'guardian' => ['sometimes', 'array'],
        ]);
        $photo = $validated['photo'] ?? null;
        $bFormDocument = $validated['b_form_document'] ?? null;
        unset($validated['photo'], $validated['b_form_document']);
        if ($photo) {
            $validated['photo_path'] = $photo->store("students/{$schoolRecord->id}/photos", 'local');
        }
        if ($bFormDocument) {
            $validated['b_form_document_path'] = $bFormDocument->store("students/{$schoolRecord->id}/documents", 'local');
        }
        if (isset($validated['guardian'])) {
            $guardian = $validated['guardian'];
            unset($validated['guardian']);
            if ($studentRecord->guardian) {
                $studentRecord->guardian->update($guardian);
            } elseif (collect($guardian)->filter()->isNotEmpty()) {
                $validated['guardian_id'] = $schoolRecord->guardians()->create($guardian)->id;
            }
        }
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
            'academic_year' => ['sometimes', 'string', 'regex:/^\d{4}-\d{4}$/', 'max:20'],
            'enrolled_on' => ['sometimes', 'date'],
        ]);
        $activeSession = $schoolRecord->schoolSessions()->where('is_current', true)->first();
        if (! $activeSession) {
            throw ValidationException::withMessages(['academic_year' => ['Set an active academic year before enrolling students.']]);
        }
        $academicYear = $activeSession->starts_on->format('Y').'-'.$activeSession->ends_on->format('Y');
        if (isset($validated['academic_year']) && $validated['academic_year'] !== $academicYear) {
            throw ValidationException::withMessages(['academic_year' => ['New enrollments must use the school’s active academic year.']]);
        }
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

        $enrollment = DB::transaction(function () use ($studentRecord, $schoolRecord, $gradeId, $sectionId, $enrolledOn, $previousEnrollmentEndDate): Enrollment {
            $studentRecord = Student::query()->whereKey($studentRecord->id)->lockForUpdate()->firstOrFail();
            $studentRecord->enrollments()
                ->where('status', 'active')
                ->update(['status' => 'completed', 'ended_on' => $previousEnrollmentEndDate]);

            return $studentRecord->enrollments()->create([
                'school_id' => $schoolRecord->id,
                'grade_id' => $gradeId,
                'section_id' => $sectionId,
                'academic_year' => $academicYear,
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
            'gender' => $student->gender,
            'religion' => $student->religion,
            'email' => $student->email,
            'phone' => $student->phone,
            'address' => $student->address,
            'birth_date' => $student->birth_date?->toDateString(),
            'b_form_number' => $student->b_form_number,
            'photo_path' => $student->photo_path,
            'b_form_document_path' => $student->b_form_document_path,
            'admission_date' => $student->admission_date?->toDateString(),
            'leave_date' => $student->leave_date?->toDateString(),
            'previous_school_details' => $student->previous_school_details,
            'note' => $student->note,
            'guardian' => $student->guardian?->only(['father_name', 'father_phone', 'father_occupation', 'father_cnic', 'mother_name', 'mother_phone', 'mother_occupation', 'mother_cnic', 'is_guardian_other', 'guardian_name', 'guardian_relation', 'guardian_email', 'guardian_phone', 'guardian_occupation', 'guardian_cnic', 'guardian_address']),
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
