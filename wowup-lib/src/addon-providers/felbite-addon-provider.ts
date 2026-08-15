import { AddonProvider, GetAllResult, SearchByUrlResult } from '../addon-provider';
import { AddonSearchResult, AddonSearchResultFile } from '../addons';
import { ADDON_PROVIDER_FELBITE } from '../constants';
import { SourceRemovedAddonError } from '../errors';
import { WowInstallation } from '../models';
import { AddonChannelType, WowClientType } from '../types';
import { NetworkInterface } from '../utils';

export interface FelbiteCatalogRelease {
  id: string;
  version: string;
  channel: 'stable';
  folders?: string[];
  downloadUrl: string;
  releasedAt: string;
}

export interface FelbiteCatalogAddon {
  id: string;
  name: string;
  author: string;
  summary?: string;
  description?: string;
  thumbnailUrl?: string;
  downloads?: number;
  releasedAt?: string;
  felbiteUrl?: string;
  releases: FelbiteCatalogRelease[];
}

export class FelbiteAddonProvider extends AddonProvider {
  public readonly name = ADDON_PROVIDER_FELBITE;
  public readonly forceIgnore = false;
  public readonly allowReinstall = true;
  public readonly allowChannelChange = false;
  public readonly allowEdit = true;
  public readonly allowReScan = true;
  public readonly canShowChangelog = false;
  public enabled = true;
  public providerNote = 'WoTLK 3.3.5 addons mirrored from Felbite.';

  public constructor(
    private _catalogUrl: string,
    private _websiteUrl: string,
    private _networkInterface: NetworkInterface,
    private _headersProvider?: () => Record<string, string>,
  ) {
    super();
    this._catalogUrl = this._catalogUrl.replace(/\/$/, '');
    this._websiteUrl = this._websiteUrl.replace(/\/$/, '');
  }

  public override async getAll(installation: WowInstallation, addonIds: string[]): Promise<GetAllResult> {
    if (!this.isAscensionInstallation(installation)) {
      return { errors: [], searchResults: [] };
    }

    const errors: Error[] = [];
    const searchResults: AddonSearchResult[] = [];
    for (const addonId of addonIds) {
      if (!this.isValidAddonId(addonId)) {
        errors.push(new Error(`invalid addon id found: ${addonId}`));
        continue;
      }

      try {
        const result = await this.getById(addonId, installation);
        if (result) {
          searchResults.push(result);
        } else {
          errors.push(new SourceRemovedAddonError(addonId, new Error(`addon not found ${addonId}`)));
        }
      } catch (error) {
        errors.push(error as Error);
      }
    }

    return { errors, searchResults };
  }

  public override async getFeaturedAddons(installation: WowInstallation): Promise<AddonSearchResult[]> {
    if (!this.isAscensionInstallation(installation)) {
      return [];
    }

    return await this.getCatalogAddons(installation);
  }

  public override async searchByQuery(query: string, installation: WowInstallation): Promise<AddonSearchResult[]> {
    if (!this.isAscensionInstallation(installation) || query.trim().length === 0) {
      return [];
    }

    return await this.getCatalogAddons(installation, `query=${encodeURIComponent(query)}`);
  }

  public override async getById(addonId: string, installation: WowInstallation): Promise<AddonSearchResult | undefined> {
    if (!this.isAscensionInstallation(installation) || !this.isValidAddonId(addonId)) {
      return undefined;
    }

    const addon = await this._networkInterface.getJson<FelbiteCatalogAddon>(`${this._catalogUrl}/addons/${addonId}`, { headers: this.getHeaders() });
    return this.toSearchResult(addon, installation);
  }

  public override async searchByUrl(addonUri: URL, installation: WowInstallation): Promise<SearchByUrlResult> {
    const addonId = this.getAddonId(addonUri);
    const searchResult = await this.getById(addonId, installation);
    if (!searchResult) {
      throw new Error(`Felbite addon not found: ${addonUri.toString()}`);
    }

    return { errors: [], searchResult };
  }

  public override async getDescription(installation: WowInstallation, externalId: string): Promise<string> {
    if (!this.isAscensionInstallation(installation) || !this.isValidAddonId(externalId)) {
      return '';
    }

    try {
      const addon = await this._networkInterface.getJson<FelbiteCatalogAddon>(`${this._catalogUrl}/addons/${externalId}`, { headers: this.getHeaders() });
      return addon.description ?? addon.summary ?? '';
    } catch (error) {
      console.error('Failed to get Felbite addon details', error);
      return '';
    }
  }

  public override isValidAddonUri(addonUri: URL): boolean {
    return (
      (addonUri.hostname === 'felbite.com' || addonUri.hostname === 'www.felbite.com') &&
      /^\/addon\/\d+(?:-|\/|$)/.test(addonUri.pathname)
    );
  }

  public override isValidAddonId(addonId: string): boolean {
    return typeof addonId === 'string' && /^\d+$/.test(addonId);
  }

  private async getCatalogAddons(installation: WowInstallation, query = ''): Promise<AddonSearchResult[]> {
    const url = `${this._catalogUrl}/addons${query ? `?${query}` : ''}`;
    const addons = await this._networkInterface.getJson<FelbiteCatalogAddon[]>(url, { headers: this.getHeaders() });
    return addons
      .map((addon) => this.toSearchResult(addon, installation))
      .filter((addon): addon is AddonSearchResult => addon !== undefined);
  }

  private getAddonId(addonUri: URL): string {
    const match = /^\/addon\/(\d+)(?:-|\/|$)/.exec(addonUri.pathname);
    if (!match) {
      throw new Error(`Unhandled Felbite URL: ${addonUri.toString()}`);
    }
    return match[1];
  }

  private getHeaders(): Record<string, string> {
    try {
      return this._headersProvider?.() ?? {};
    } catch (error) {
      console.error('Failed to create Felbite telemetry headers', error);
      return {};
    }
  }

  private toSearchResult(addon: FelbiteCatalogAddon, installation: WowInstallation): AddonSearchResult | undefined {
    if (!addon?.id || !this.isAscensionInstallation(installation)) {
      return undefined;
    }

    const files = (addon.releases ?? [])
      .map((release) => this.toSearchResultFile(release))
      .filter((file): file is AddonSearchResultFile => file !== undefined);
    if (files.length === 0) {
      return undefined;
    }

    return {
      author: addon.author,
      downloadCount: addon.downloads,
      externalId: addon.id,
      externalUrl: addon.felbiteUrl ?? `${this._websiteUrl}/addon/${addon.id}`,
      files,
      name: addon.name,
      providerName: this.name,
      releasedAt: addon.releasedAt ? new Date(addon.releasedAt) : undefined,
      summary: addon.summary,
      thumbnailUrl: addon.thumbnailUrl ?? '',
    };
  }

  private toSearchResultFile(release: FelbiteCatalogRelease): AddonSearchResultFile | undefined {
    if (!release?.id || !release.downloadUrl || !release.version) {
      return undefined;
    }

    return {
      channelType: AddonChannelType.Stable,
      downloadUrl: release.downloadUrl,
      externalId: release.id,
      folders: release.folders ?? [],
      gameVersion: '3.3.5',
      releaseDate: new Date(release.releasedAt),
      version: release.version,
    };
  }

  private isAscensionInstallation(installation: WowInstallation): boolean {
    return installation.clientType === WowClientType.Ascension;
  }
}
