import { BehaviorSubject, firstValueFrom } from "rxjs";
import { AddonProviderType } from "wowup-lib-core";

import { Component, OnInit } from "@angular/core";
import { MatSelectionListChange } from "@angular/material/list";
import { TranslateService } from "@ngx-translate/core";

import { AddonProviderState } from "../../../models/wowup/addon-provider-state";
import { AddonProviderFactory } from "../../../services/addons/addon.provider.factory";
import { DialogFactory } from "../../../services/dialog/dialog.factory";
import { AddonStorageService } from "../../../services/storage/addon-storage.service";

interface AddonProviderStateModel extends AddonProviderState {
  adRequired: boolean;
  providerNote?: string;
}

@Component({
  selector: "app-options-addon-section",
  templateUrl: "./options-addon-section.component.html",
  styleUrls: ["./options-addon-section.component.scss"],
})
export class OptionsAddonSectionComponent implements OnInit {
  public addonProviderStates$ = new BehaviorSubject<AddonProviderStateModel[]>([]);

  public constructor(
    private _addonProviderService: AddonProviderFactory,
    private _addonStorageService: AddonStorageService,
    private _translateService: TranslateService,
    private _dialogFactory: DialogFactory,
  ) {
    this._addonProviderService.addonProviderChange$.subscribe(() => {
      this.loadProviderStates();
    });
  }

  public ngOnInit(): void {
    this.loadProviderStates();
  }

  public async onProviderStateSelectionChange(event: MatSelectionListChange): Promise<void> {
    for (const option of event.options) {
      const providerName: AddonProviderType = option.value;

      await this._addonProviderService.setProviderEnabled(providerName, option.selected);
    }
  }

  public async onClearAscensionAssignments(): Promise<void> {
    const title: string = this._translateService.instant("PAGES.OPTIONS.ADDON.ASCENSION.CLEAR_TITLE");
    const message: string = this._translateService.instant("PAGES.OPTIONS.ADDON.ASCENSION.CLEAR_MESSAGE");
    const confirmed = await firstValueFrom(this._dialogFactory.getConfirmDialog(title, message).afterClosed());
    if (!confirmed) {
      return;
    }

    const addons = await this._addonStorageService.getAllForProviderAsync("Ascension");
    await this._addonStorageService.removeAllAsync(...addons);
    window.location.reload();
  }

  private loadProviderStates() {
    const providerStates = this._addonProviderService.getAddonProviderStates().filter((provider) => provider.canEdit);
    const providerStateModels: AddonProviderStateModel[] = providerStates.map((state) => {
      const provider = this._addonProviderService.getProvider(state.providerName);
      if (provider === undefined) {
        throw new Error("loadProviderStates got undefined provider");
      }

      return { ...state, adRequired: provider.adRequired, providerNote: provider.providerNote };
    });

    this.addonProviderStates$.next(providerStateModels);
  }
}
