import { createServer, type Server } from 'node:http';
import { parse as parseUrl } from 'node:url';
import { AuthTokenSchema, type AuthToken, AniListAuthError } from './types.js';
import { anilistConfig } from './config/anilist.config.js';

/**
 * OAuth authentication options
 */
export interface AuthOptions {
  clientId: string;
  clientSecret: string;
  redirectUri?: string;
  onAuthorizationUrl?: (url: string) => void | Promise<void>;
}

/**
 * AniList OAuth 2.0 authentication handler
 * Implements Implicit Grant flow with local callback server
 */
export class AniListAuth {
  private config = anilistConfig.oauth;
  private server?: Server;

  constructor(private options: AuthOptions) {}

  /**
   * Generate OAuth authorization URL
   */
  getAuthorizationUrl(): string {
    const params = new URLSearchParams({
      client_id: this.options.clientId,
      redirect_uri: this.options.redirectUri || this.config.redirectUri,
      response_type: 'code',
    });

    return `${this.config.authorizeUrl}?${params}`;
  }

  /**
   * Start OAuth flow with local callback server
   * Opens authorization URL and waits for callback
   * @returns Access token
   */
  async authenticate(): Promise<AuthToken> {
    const authUrl = this.getAuthorizationUrl();

    // Notify caller about authorization URL (to open browser)
    if (this.options.onAuthorizationUrl) {
      await this.options.onAuthorizationUrl(authUrl);
    } else {
      console.log('\n📋 Please visit this URL to authorize:');
      console.log(`\n   ${authUrl}\n`);
    }

    // Start local server to receive callback
    const code = await this.waitForCallback();

    // Exchange code for token
    const token = await this.exchangeCodeForToken(code);

    return token;
  }

  /**
   * Start local HTTP server and wait for OAuth callback
   * @returns Authorization code
   */
  private waitForCallback(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.server = createServer((req, res) => {
        const url = parseUrl(req.url || '', true);

        if (url.pathname === '/callback') {
          const code = url.query.code as string;
          const error = url.query.error as string;

          if (error) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end(
              '<html><body><h1>❌ Authorization Failed</h1><p>You can close this window.</p></body></html>',
            );
            reject(new AniListAuthError(`OAuth error: ${error}`));
            this.server?.close();
            return;
          }

          if (code) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(
              '<html><body><h1>✅ Authorization Successful!</h1><p>You can close this window and return to the terminal.</p></body></html>',
            );
            resolve(code);
            this.server?.close();
            return;
          }
        }

        res.writeHead(404);
        res.end('Not found');
      });

      // TODO: replace the magic number with a config option
      const port = new URL(this.options.redirectUri || this.config.redirectUri).port || 8888;
      this.server.listen(Number(port), () => {
        console.log(`🔓 Listening for OAuth callback on port ${port}...`);
      });

      // Timeout after 5 minutes
      setTimeout(() => {
        reject(new AniListAuthError('OAuth timeout - no callback received within 5 minutes'));
        this.server?.close();
      }, 300000);
    });
  }

  /**
   * Exchange authorization code for access token
   * @param code Authorization code from callback
   * @returns Access token with expiration info
   */
  async exchangeCodeForToken(code: string): Promise<AuthToken> {
    const response = await fetch(this.config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: this.options.clientId,
        client_secret: this.options.clientSecret,
        redirect_uri: this.options.redirectUri || this.config.redirectUri,
        code,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new AniListAuthError(`Token exchange failed: ${error}`);
    }

    const data = await response.json();

    // AniList tokens don't expire, but set a far future date
    const token = AuthTokenSchema.parse({
      accessToken: data.access_token,
      tokenType: data.token_type,
      expiresIn: data.expires_in || 31536000, // 1 year default
      expiresAt: Date.now() + (data.expires_in || 31536000) * 1000,
    });

    return token;
  }

  /**
   * Clean up callback server if still running
   */
  cleanup(): void {
    if (this.server) {
      this.server.close();
      this.server = undefined;
    }
  }
}
