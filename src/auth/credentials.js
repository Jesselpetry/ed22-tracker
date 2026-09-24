import { input, password } from "@inquirer/prompts";

const STUDENT_ID = /^\d{8}$/;

export function usesDefaultPassword(username, pass) {
  return pass === username.slice(-5);
}

// Env vars first (for scripts / --json), otherwise an interactive masked prompt.
export async function getCredentials({ interactive, defaultUsername }) {
  const envUser = process.env.ED22_USERNAME?.trim();
  const envPass = process.env.ED22_PASSWORD;

  if (!interactive && (!envUser || !envPass)) {
    throw new Error("Not signed in. Set ED22_USERNAME and ED22_PASSWORD (see .env.example) or run in a terminal.");
  }

  const username = envUser || (await input({
    message: "Student ID",
    default: defaultUsername,
    validate: (v) => STUDENT_ID.test(v.trim()) || "Enter your 8-digit KMITL student ID",
  })).trim();

  const pass = envPass || await password({
    message: "ED22 password",
    mask: "•",
    validate: (v) => v.length > 0 || "Password is required",
  });

  return { username, password: pass };
}
