import { HttpClient, HttpErrorResponse } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { v4 as uuidv4 } from "uuid";

import { AppConfig } from "../../../environments/environment";
import { IPC_ASCENSION_AUTHOR_API_REQUEST, STORAGE_ASCENSION_CLIENT_ID } from "../../../common/constants";
import { ElectronService } from "../electron/electron.service";
import { PreferenceStorageService } from "../storage/preference-storage.service";

export type AscensionTelemetryEventType = "update_available" | "download_started" | "download_completed" | "install_succeeded" | "install_failed";

export interface AscensionAuthor {
  login: string;
  name?: string;
  avatarUrl?: string;
}

export interface AscensionRelease {
  id: string;
  version: string;
  channel: "stable" | "beta";
  folders: string[];
  downloadUrl: string;
  releasedAt: string;
  changelog?: string;
}

export interface AscensionAddonPayload {
  id?: string;
  name: string;
  author: string;
  folders: string[];
  githubRepository?: string;
  releases?: AscensionRelease[];
  summary?: string;
  description?: string;
  thumbnailUrl?: string;
}

export type AscensionAddon = AscensionAddonPayload & { id: string };
export type AddonCompatibilityVote = "up" | "down";
export interface AddonCompatibilityVoteCounts {
  up: number;
  down: number;
}

export class AscensionApiError extends Error {
  public constructor(
    public readonly status: number,
    public readonly apiError?: string,
  ) {
    super(apiError);
  }
}

@Injectable({ providedIn: "root" })
export class AscensionAuthorApiService {
  private readonly _apiUrl = AppConfig.ascension.apiUrl;
  private readonly _catalogUrl = AppConfig.ascension.catalogUrl;
  private _clientId?: string;
  private _appVersion?: string;

  public constructor(
    private _http: HttpClient,
    private _electronService: ElectronService,
    private _preferenceStorageService: PreferenceStorageService,
  ) {}

  public async getAuthor(): Promise<AscensionAuthor | undefined> {
    try {
      return await this.request<AscensionAuthor>("GET", "/v1/auth/me");
    } catch (error) {
      if (this.getStatus(error) === 401) {
        return undefined;
      }
      throw error;
    }
  }

  public logout(): Promise<void> {
    return this.request<void>("POST", "/v1/auth/logout");
  }

  public createAddon(addon: AscensionAddonPayload): Promise<AscensionAddon> {
    return this.request<AscensionAddon>("POST", "/v1/ascension/addons", addon);
  }

  public updateAddon(id: string, addon: AscensionAddonPayload): Promise<AscensionAddon> {
    return this.request<AscensionAddon>("PUT", `/v1/ascension/addons/${encodeURIComponent(id)}`, addon);
  }

  public getPublicAddon(id: string): Promise<AscensionAddon> {
    return firstValueFrom(
      this._http.get<AscensionAddon>(`${this._catalogUrl}/addons/${encodeURIComponent(id)}`, {
        withCredentials: true,
      }),
    );
  }

  public getTelemetryHeaders(): Record<string, string> {
    try {
      return {
        "x-client-id": this.getClientId(),
        "x-client-version": this._appVersion ?? "",
        "x-client-os": this.getOs(),
      };
    } catch (error) {
      console.error("Failed to create Ascension telemetry headers", error);
      return {};
    }
  }

  public getClientId(): string {
    if (!this._clientId) {
      const stored = this._preferenceStorageService.getSync<string>(STORAGE_ASCENSION_CLIENT_ID);
      if (stored) {
        this._clientId = stored;
      } else {
        this._clientId = uuidv4();
        this._preferenceStorageService.setAsync(STORAGE_ASCENSION_CLIENT_ID, this._clientId).catch(console.error);
      }
    }
    return this._clientId;
  }

  public getOs(): string {
    return typeof process !== "undefined" && process.platform ? process.platform : "";
  }

  public async getClientVersion(): Promise<string> {
    if (!this._appVersion) {
      try {
        this._appVersion = await this._electronService.getVersionNumber();
      } catch (error) {
        console.error("Failed to resolve Ascension client version", error);
      }
    }
    return this._appVersion ?? "";
  }

  public reportDownload(addonId: string, releaseId?: string): void {
    this.reportTelemetry("download_completed", addonId, releaseId);
  }

  public reportTelemetry(type: AscensionTelemetryEventType, addonId: string, releaseId?: string, error?: string): void {
    this.getClientVersion()
      .then((version) => {
        const body: Record<string, string> = {
          type,
          addonId,
          version,
          os: this.getOs(),
          clientId: this.getClientId(),
        };
        if (releaseId) {
          body.releaseId = releaseId;
        }
        if (error) {
          body.error = error;
        }
        this._http.post(`${this._apiUrl}/v1/telemetry/events`, body, { withCredentials: true }).subscribe({
          error: (err) => console.error("Failed to report Ascension telemetry", err),
        });
      })
      .catch((err) => console.error("Failed to report Ascension telemetry", err));
  }

  public reportCompatibilityVote(addonId: string, providerName: string, vote: AddonCompatibilityVote): void {
    this._http
      .post(`${this._apiUrl}/v1/ascension/votes`, { addonId, providerName, vote }, { withCredentials: true })
      .subscribe({
        error: (error) => console.error("Failed to report addon compatibility vote", error),
      });
  }

  public async getCompatibilityVotes(addonIds: string[]): Promise<Record<string, AddonCompatibilityVoteCounts>> {
    if (addonIds.length === 0) {
      return {};
    }

    return await firstValueFrom(
      this._http.get<Record<string, AddonCompatibilityVoteCounts>>(
        `${this._apiUrl}/v1/ascension/votes?providerName=Felbite&addonIds=${encodeURIComponent(addonIds.join(","))}`,
        { withCredentials: true },
      ),
    );
  }

  public getOwnedAddons(): Promise<AscensionAddon[]> {
    return this.request<AscensionAddon[]>("GET", "/v1/ascension/addons/mine");
  }

  public getGithubLoginUrl(): string {
    return `${this._apiUrl}/v1/auth/github`;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await this._electronService.invoke<{ status: number; body: T & { error?: string } }>(
      IPC_ASCENSION_AUTHOR_API_REQUEST,
      { method, path, body },
    );
    if (response.status < 200 || response.status >= 300) {
      throw new AscensionApiError(response.status, response.body?.error);
    }
    return response.body;
  }

  private getStatus(error: unknown): number | undefined {
    return error instanceof HttpErrorResponse
      ? error.status
      : error instanceof AscensionApiError
        ? error.status
        : undefined;
  }
}
