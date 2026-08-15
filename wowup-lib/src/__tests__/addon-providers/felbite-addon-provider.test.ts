import { FelbiteAddonProvider, FelbiteCatalogAddon } from '../../addon-providers';
import { createMockWowInstallation } from '../../mocks/mock-wow-installation';
import { WowInstallation } from '../../models';
import { AddonChannelType, WowClientType } from '../../types';
import { NetworkInterface, PostConfig } from '../../utils';

const CATALOG_URL = 'https://api.example.test/v1/felbite';
const WEBSITE_URL = 'https://felbite.com';

const addon: FelbiteCatalogAddon = {
  id: '3848',
  name: 'Details!DamageMeter',
  author: 'Terciob',
  summary: 'Essential tool to impress that chick in your raid.',
  description: '<p>Detailed combat information.</p>',
  thumbnailUrl: 'https://cdn.example.test/details.webp',
  downloads: 216553,
  felbiteUrl: 'https://felbite.com/addon/3848-detailsdamagemeter/',
  releases: [
    {
      id: 'https://cdn.example.test/details-1.3.0.zip',
      version: '1.3.0',
      channel: 'stable',
      downloadUrl: 'https://cdn.example.test/details-1.3.0.zip',
      releasedAt: '2022-11-08T19:47:44.000Z',
    },
  ],
};

class CatalogNetworkInterface implements NetworkInterface {
  public urls: string[] = [];

  public async getJson<T>(url: string | URL): Promise<T> {
    const value = url.toString();
    this.urls.push(value);
    if (value.endsWith('/addons/3848')) {
      return addon as T;
    }
    if (value.startsWith(`${CATALOG_URL}/addons`)) {
      return [addon] as T;
    }
    throw new Error(`Unexpected URL: ${value}`);
  }

  public async postJson<T>(_url: string | URL, _config: PostConfig): Promise<T> {
    void _url;
    void _config;
    throw new Error('Unexpected POST');
  }

  public async getText(_url: string | URL): Promise<string> {
    void _url;
    throw new Error('Unexpected text request');
  }
}

function createProvider(network = new CatalogNetworkInterface()): FelbiteAddonProvider {
  return new FelbiteAddonProvider(CATALOG_URL, WEBSITE_URL, network);
}

function createAscensionInstallation(): WowInstallation {
  return { ...createMockWowInstallation(), clientType: WowClientType.Ascension };
}

test('FelbiteAddonProvider searches the mirrored catalog', async () => {
  const network = new CatalogNetworkInterface();
  const results = await createProvider(network).searchByQuery('details', createAscensionInstallation());

  expect(network.urls).toEqual([`${CATALOG_URL}/addons?query=details`]);
  expect(results[0]).toMatchObject({
    externalId: '3848',
    externalUrl: 'https://felbite.com/addon/3848-detailsdamagemeter/',
    providerName: 'Felbite',
  });
  expect(results[0].files?.[0]).toMatchObject({
    channelType: AddonChannelType.Stable,
    externalId: 'https://cdn.example.test/details-1.3.0.zip',
    folders: [],
    gameVersion: '3.3.5',
  });
});

test('FelbiteAddonProvider does not query non-Ascension installations', async () => {
  const network = new CatalogNetworkInterface();
  await expect(createProvider(network).getFeaturedAddons(createMockWowInstallation())).resolves.toEqual([]);
  expect(network.urls).toEqual([]);
});

test('FelbiteAddonProvider reads descriptions from the mirrored catalog', async () => {
  await expect(createProvider().getDescription(createAscensionInstallation(), '3848')).resolves.toBe(
    '<p>Detailed combat information.</p>',
  );
});

test('FelbiteAddonProvider resolves Felbite addon URLs through the mirrored catalog', async () => {
  const network = new CatalogNetworkInterface();
  const result = await createProvider(network).searchByUrl(
    new URL('https://felbite.com/addon/3848-detailsdamagemeter/'),
    createAscensionInstallation(),
  );

  expect(network.urls).toEqual([`${CATALOG_URL}/addons/3848`]);
  expect(result.searchResult?.externalId).toBe('3848');
});
