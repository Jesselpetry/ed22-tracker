import { ApiError } from "./client.js";
import { CANONICAL_DOMAIN, COMMUNITY_VERSION, INSTITUTION_ID } from "./constants.js";

export class LoginError extends Error {
  constructor(message, reason) {
    super(message);
    this.name = "LoginError";
    this.reason = reason;
  }
}

// ED22's default password is the last 5 digits of the student ID.
export function usesDefaultPassword(username, password) {
  return password === String(username).slice(-5);
}

export async function login(client, { username, password }) {
  const params = { CommunityVersion: COMMUNITY_VERSION, needOptIn: true, cannonicalDomain: CANONICAL_DOMAIN };
  let data;
  try {
    data = await client.post(
      "Auth/ForceLogin/",
      { ...params, InstitutionId: INSTITUTION_ID, UserName: username, Password: password },
      { query: params },
    );
  } catch (err) {
    if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
      throw new LoginError("Student ID or password is incorrect.", "credentials");
    }
    throw err;
  }

  if (!data?.UserInfo) {
    throw new LoginError("Student ID or password is incorrect.", "credentials");
  }
  if (!data.UserInfo.Token) {
    throw new LoginError(
      "ED22 says you are already signed in on the website. Sign out at ed22.engdis.com/thai and try again.",
      "active-session",
    );
  }
  return data.UserInfo.Token;
}

export async function logout(client) {
  await client.get("Auth/Logout");
}

// Root progress tree: overall progress/grade and one child per unit.
export async function getOverview(client) {
  const data = await client.get("CourseTree/GetDefaultCourseProgress");
  if (!data?.CourseProgressTree) {
    throw new ApiError("ED22 progress response is missing CourseProgressTree");
  }
  return data.CourseProgressTree;
}

// Lessons -> steps -> tasks for one unit, with per-node progress.
export async function getUnitTree(client, { nodeId, parentNodeId }) {
  const data = await client.post(`CourseTree/GetUserNodeProgress/${parentNodeId}`, [
    { ParticleId: nodeId, NodeType: 2, LockedNodes: null, particleHasProgress: true, lowestNodeType: 5 },
  ]);
  return Array.isArray(data?.[0]?.Children) ? data[0].Children : [];
}
