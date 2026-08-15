import { Injectable } from "@angular/core";
import { filter, firstValueFrom } from "rxjs";
import { Addon } from "wowup-lib-core";

import { ADDON_PROVIDER_FELBITE, ADDON_VOTE_PREFERENCE_KEY_PREFIX } from "../../../common/constants";
import { AddonInstallState } from "../../models/wowup/addon-install-state";
import { AscensionAuthorApiService, AddonCompatibilityVote } from "../ascension/ascension-author-api.service";
import { DialogFactory } from "../dialog/dialog.factory";
import { PreferenceStorageService } from "../storage/preference-storage.service";
import { AddonService } from "./addon.service";

type AddonVoteResponse = AddonCompatibilityVote | "dismissed";

@Injectable({ providedIn: "root" })
export class AddonVoteService {
  private readonly _pendingAddonIds = new Set<string>();

  public constructor(
    addonService: AddonService,
    private _ascensionApiService: AscensionAuthorApiService,
    private _dialogFactory: DialogFactory,
    private _preferenceStorageService: PreferenceStorageService,
  ) {
    addonService.addonInstalled$
      .pipe(
        filter(
          (event) =>
            event.installState === AddonInstallState.Complete && event.addon.providerName === ADDON_PROVIDER_FELBITE,
        ),
      )
      .subscribe((event) => void this.promptForVote(event.addon));
  }

  private async promptForVote(addon: Addon): Promise<void> {
    if (!addon.externalId) {
      return;
    }

    const preferenceKey = `${ADDON_VOTE_PREFERENCE_KEY_PREFIX}${ADDON_PROVIDER_FELBITE}_${addon.externalId}`;
    if (this._pendingAddonIds.has(preferenceKey) || (await this._preferenceStorageService.getAsync(preferenceKey))) {
      return;
    }

    this._pendingAddonIds.add(preferenceKey);
    try {
      const result = await firstValueFrom(
        this._dialogFactory.getAddonVoteDialog({ addonName: addon.name }).afterClosed(),
      );
      const response: AddonVoteResponse = result ?? "dismissed";
      await this._preferenceStorageService.setAsync(preferenceKey, response);

      if (result) {
        this._ascensionApiService.reportCompatibilityVote(addon.externalId, ADDON_PROVIDER_FELBITE, result);
      }
    } finally {
      this._pendingAddonIds.delete(preferenceKey);
    }
  }
}
