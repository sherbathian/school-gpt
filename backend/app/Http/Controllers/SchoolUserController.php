<?php

namespace App\Http\Controllers;

use App\Models\School;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class SchoolUserController extends Controller
{
    public function index(Request $request, int $school): JsonResponse
    {
        $schoolRecord = $this->accessibleSchool($request, $school);
        Gate::authorize('manageUsers', $schoolRecord);

        return response()->json([
            'data' => $schoolRecord->users()
                ->orderBy('users.name')
                ->get(['users.id', 'users.name', 'users.email'])
                ->map(fn (User $user) => $this->memberData($user))
                ->values(),
        ]);
    }

    public function store(Request $request, int $school): JsonResponse
    {
        $schoolRecord = $this->accessibleSchool($request, $school);
        Gate::authorize('manageUsers', $schoolRecord);

        $validated = $request->validate([
            'email' => ['required', 'email', 'max:255'],
            'role' => ['required', Rule::in(['school_admin', 'teacher'])],
        ]);
        $this->ensureRoleCanBeAssigned($request->user(), $validated['role']);

        $user = User::query()->where('email', $validated['email'])->first();

        if (! $user) {
            throw ValidationException::withMessages([
                'email' => ['No account exists for this email. Ask an administrator to provision the account first.'],
            ]);
        }

        if ($schoolRecord->users()->whereKey($user->id)->exists()) {
            throw ValidationException::withMessages(['email' => ['This user already belongs to the school.']]);
        }

        $schoolRecord->users()->attach($user, [
            'role' => $validated['role'],
            'is_active' => true,
        ]);

        $member = $schoolRecord->users()->whereKey($user->id)->firstOrFail();

        return response()->json(['data' => $this->memberData($member)], 201);
    }

    public function update(Request $request, int $school, int $user): JsonResponse
    {
        $schoolRecord = $this->accessibleSchool($request, $school);
        $member = $schoolRecord->users()->whereKey($user)->firstOrFail();
        Gate::authorize('manageMember', [$schoolRecord, $member]);

        $validated = $request->validate([
            'role' => ['sometimes', 'required', Rule::in(['school_admin', 'teacher'])],
            'is_active' => ['sometimes', 'required', 'boolean'],
        ]);

        if (isset($validated['role'])) {
            $this->ensureRoleCanBeAssigned($request->user(), $validated['role']);
        }

        $schoolRecord->users()->updateExistingPivot($member->id, $validated);

        $member = $schoolRecord->users()->whereKey($member->id)->firstOrFail();

        return response()->json(['data' => $this->memberData($member)]);
    }

    public function destroy(Request $request, int $school, int $user): JsonResponse
    {
        $schoolRecord = $this->accessibleSchool($request, $school);
        $member = $schoolRecord->users()->whereKey($user)->firstOrFail();
        Gate::authorize('manageMember', [$schoolRecord, $member]);
        $schoolRecord->users()->detach($member->id);

        return response()->json([], 204);
    }

    /** @return array<string, mixed> */
    private function memberData(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->pivot->role,
            'is_active' => (bool) $user->pivot->is_active,
        ];
    }

    private function ensureRoleCanBeAssigned(User $actor, string $role): void
    {
        if (! $actor->isSuperAdmin() && $role !== 'teacher') {
            throw ValidationException::withMessages([
                'role' => ['Only a global administrator can grant school administrator access.'],
            ]);
        }
    }

    private function accessibleSchool(Request $request, int $school): School
    {
        $schools = $request->user()->isSuperAdmin()
            ? School::query()
            : $request->user()->activeSchools();

        return $schools->whereKey($school)->firstOrFail();
    }
}
