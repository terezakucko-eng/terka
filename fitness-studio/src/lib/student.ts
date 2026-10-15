import { dateKey } from "@/lib/dates";

/** A verified student today – "Student do" on the client card hasn't passed yet. */
export const isStudent = (u: { studentUntil: string | null } | null | undefined, now = new Date()) =>
  !!u?.studentUntil && u.studentUntil >= dateKey(now);

/** What a client not verified yet confirms when buying at the student price. */
export const STUDENT_CONFIRM = "Studuji – ISIC nebo potvrzení o studiu ukážu ve studiu, případně nahraju jeho fotku v Můj účet → Profil.";
