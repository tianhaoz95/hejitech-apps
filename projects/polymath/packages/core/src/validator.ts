import type { Course, Chapter } from "./types.js";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateChapter(chapter: Chapter): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!chapter.id || chapter.id.trim() === "") {
    errors.push("Chapter id is required");
  }
  if (!chapter.title || chapter.title.trim() === "") {
    errors.push("Chapter title is required");
  }
  if (!chapter.markdownContent || chapter.markdownContent.trim() === "") {
    warnings.push(`Chapter '${chapter.title || chapter.id}' has empty markdown content.`);
  }

  for (const [idx, comp] of chapter.components.entries()) {
    if (comp.kind === "CodeExercise") {
      if (!comp.props.targetFile) {
        errors.push(`Exercise #${idx + 1} is missing targetFile`);
      }
      if (!comp.props.testFile) {
        errors.push(`Exercise #${idx + 1} is missing testFile`);
      }
    } else if (comp.kind === "SocraticQuiz") {
      if (!comp.props.question) {
        errors.push(`Quiz #${idx + 1} is missing question text`);
      }
      if (!comp.props.options || comp.props.options.length < 2) {
        errors.push(`Quiz #${idx + 1} must have at least 2 options`);
      }
      if (
        comp.props.correctAnswerIndex < 0 ||
        comp.props.correctAnswerIndex >= (comp.props.options?.length || 0)
      ) {
        errors.push(
          `Quiz #${idx + 1} correctAnswerIndex (${comp.props.correctAnswerIndex}) out of bounds (options: ${comp.props.options?.length})`
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function validateCourse(course: Course): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!course.id || course.id.trim() === "") {
    errors.push("Course id is required");
  }
  if (!course.title || course.title.trim() === "") {
    errors.push("Course title is required");
  }
  if (!course.chapters || course.chapters.length === 0) {
    errors.push("Course must have at least one chapter");
  }

  for (const chapter of course.chapters || []) {
    const res = validateChapter(chapter);
    errors.push(...res.errors);
    warnings.push(...res.warnings);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
