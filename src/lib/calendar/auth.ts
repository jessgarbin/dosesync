export async function getAuthToken(): Promise<string> {
  try {
    const result = await chrome.identity.getAuthToken({ interactive: true });
    if (!result.token) {
      throw new Error('OAuth token not obtained. The user may have denied authorization.');
    }
    return result.token;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('canceled') || message.includes('denied')) {
      throw new Error('Google Calendar authorization denied by the user.');
    }
    throw new Error(`Failed to obtain OAuth token: ${message}`);
  }
}

export async function revokeAuthToken(token: string): Promise<void> {
  await chrome.identity.removeCachedAuthToken({ token });
  const res = await fetch('https://oauth2.googleapis.com/revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `token=${token}`,
  });
  if (!res.ok) {
    throw new Error('Failed to revoke Google token.');
  }
}
