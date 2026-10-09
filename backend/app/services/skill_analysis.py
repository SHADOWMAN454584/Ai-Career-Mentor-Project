from collections import defaultdict
from difflib import SequenceMatcher
from typing import Any
from uuid import uuid4

from fastapi import HTTPException

from ..catalog import ALIASES, COURSES, PREREQUISITES, ROLES

KNOWN_SKILLS = sorted({skill for role in ROLES.values() for skill in role} | set(ALIASES) | {"java", "c++", "tensorflow", "numpy", "communication", "projects", "internship"})


def normalize_skill(skill: str) -> str:
    value = " ".join(skill.lower().strip().split())
    return ALIASES.get(value, value)


def similarity(a: str, b: str) -> float:
    normalized_a, normalized_b = normalize_skill(a), normalize_skill(b)
    if normalized_a == normalized_b:
        return 1.0
    return SequenceMatcher(None, normalized_a, normalized_b).ratio()


def role_scores(skills: list[str]) -> list[dict[str, Any]]:
    results = []
    for role, required in ROLES.items():
        matches = [max((similarity(req, skill) for skill in skills), default=0.0) for req in required]
        score = round(100 * sum(matches) / len(required), 1)
        contributors = [required[index] for index, match in enumerate(matches) if match >= 0.72]
        results.append({"role_name": role, "match_score": score, "contributing_skills": contributors})
    return sorted(results, key=lambda item: item["match_score"], reverse=True)[:5]


def detect_gaps(skills: list[str], role: str) -> list[dict[str, Any]]:
    required = ROLES.get(role)
    if not required:
        raise HTTPException(status_code=422, detail=f"Unknown target role. Choose one of: {', '.join(ROLES)}")
    gaps = []
    for index, required_skill in enumerate(required):
        best = max(skills, key=lambda skill: similarity(required_skill, skill), default=None)
        score = similarity(required_skill, best) if best else 0.0
        if score < 0.72:
            gaps.append({"skill": required_skill, "closest_match": best, "similarity": round(score, 2), "importance": len(required) - index, "explanation": f"{required_skill.title()} is a core requirement for {role}."})
    return sorted(gaps, key=lambda item: (-item["importance"], item["similarity"]))


def recommend_courses(gaps: list[dict[str, Any]]) -> list[dict[str, Any]]:
    output = []
    for gap in gaps:
        candidates = sorted(COURSES, key=lambda course: similarity(gap["skill"], course["skill"]), reverse=True)[:3]
        output.append({"skill_gap": gap["skill"], "recommendations": [{**course, "relevance_score": round(similarity(gap["skill"], course["skill"]) * 100, 1)} for course in candidates]})
    return output


def readiness(profile: dict[str, Any]) -> tuple[float, list[dict[str, Any]]]:
    skill_count = len(profile["skills"])
    projects = len(profile["projects"])
    experience_years = profile["experience"].get("years", 0)
    cgpa = profile["education"].get("cgpa") or 6.5
    score = min(0.92, max(0.18, 0.22 + skill_count * 0.035 + projects * 0.045 + experience_years * 0.05 + (cgpa - 6) * 0.045))
    factors = [
        {"feature": "skill_count", "impact": round(min(skill_count, 10) * 0.035, 3), "direction": "up"},
        {"feature": "project_count", "impact": round(projects * 0.045, 3), "direction": "up"},
        {"feature": "experience_years", "impact": round(experience_years * 0.05, 3), "direction": "up"},
        {"feature": "cgpa", "impact": round((cgpa - 6) * 0.045, 3), "direction": "up" if cgpa >= 6 else "down"},
    ]
    return round(score, 2), factors


def build_roadmap(gaps: list[dict[str, Any]], weeks: int) -> list[dict[str, Any]]:
    missing = {gap["skill"] for gap in gaps}
    ordered, visiting, visited = [], set(), set()

    def visit(skill: str) -> None:
        if skill in visited:
            return
        if skill in visiting:
            raise ValueError(f"Prerequisite cycle detected at {skill}")
        visiting.add(skill)
        for prerequisite in PREREQUISITES.get(skill, []):
            if prerequisite in missing:
                visit(prerequisite)
        visiting.remove(skill)
        visited.add(skill)
        ordered.append(skill)

    for skill in missing:
        visit(skill)
    buckets: dict[int, list[str]] = defaultdict(list)
    for index, skill in enumerate(ordered):
        buckets[min(weeks, index * weeks // max(1, len(ordered)) + 1)].append(skill)
    roadmap = []
    for week in range(1, weeks + 1):
        skills = buckets[week]
        tasks = [{"task_id": str(uuid4()), "title": f"Learn and practise {skill.title()}", "completed": False} for skill in skills]
        if skills:
            roadmap.append({"week_number": week, "focus_skills": skills, "tasks": tasks})
    return roadmap
