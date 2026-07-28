import { HttpErrorResponse } from "@angular/common/http";
import { Component, OnDestroy, OnInit } from "@angular/core";
import { Subject, takeUntil } from "rxjs";

import {
  AscensionAddon,
  AscensionAddonPayload,
  AscensionAuthor,
  AscensionAuthorApiService,
  AscensionApiError,
  AscensionRelease,
} from "../../services/ascension/ascension-author-api.service";
import { ElectronService } from "../../services/electron/electron.service";

interface ReleaseForm extends AscensionRelease {
  foldersText: string;
}

@Component({
  selector: "app-author-portal",
  templateUrl: "./author-portal.component.html",
  styleUrls: ["./author-portal.component.scss"],
})
export class AuthorPortalComponent implements OnInit, OnDestroy {
  private readonly _destroy$ = new Subject<void>();
  public author?: AscensionAuthor;
  public loading = true;
  public submitting = false;
  public editMode = false;
  public error = "";
  public success = "";
  public validationErrors: Record<string, string> = {};
  public savedAddon?: AscensionAddon;
  public form = this.createEmptyForm();

  public constructor(
    private _api: AscensionAuthorApiService,
    private _electronService: ElectronService,
  ) {}

  public ngOnInit(): void {
    this.loadAuthor();
    this._electronService.customProtocol$.pipe(takeUntil(this._destroy$)).subscribe((protocol) => {
      if (protocol === "wowup://auth/success") {
        this.loadAuthor();
      }
    });
  }

  public ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  public async loadAuthor(): Promise<void> {
    this.loading = true;
    this.error = "";
    try {
      this.author = await this._api.getAuthor();
      if (this.author && !this.form.author) {
        this.form.author = this.author.login;
      }
    } catch (error) {
      this.error = this.getApiError(error, "Unable to check your sign-in status.");
    } finally {
      this.loading = false;
    }
  }

  public signIn(): void {
    const authWindow = window.open(this._api.getGithubLoginUrl(), "wowup-author-auth", "popup,width=640,height=760");
    if (!authWindow) {
      this.error = "Unable to open the GitHub sign-in window.";
    }
  }

  public async logout(): Promise<void> {
    this.error = "";
    try {
      await this._api.logout();
      this.author = undefined;
      this.resetForm();
    } catch (error) {
      this.error = this.getApiError(error, "Unable to sign out.");
    }
  }

  public addRelease(): void {
    this.form.releases.push(this.createRelease());
  }

  public removeRelease(index: number): void {
    this.form.releases.splice(index, 1);
  }

  public onPublish(event: MouseEvent): void {
    event.preventDefault();
    void this.publish();
  }

  private async publish(): Promise<void> {
    this.validationErrors = this.validate();
    this.error = "";
    this.success = "";
    if (Object.keys(this.validationErrors).length > 0) {
      this.error = "Complete the highlighted required fields before publishing.";
      return;
    }

    this.submitting = true;
    this.success = "Publishing addon...";
    try {
      const payload = this.toPayload();
      const result = this.editMode
        ? await this._api.updateAddon(this.form.id, payload)
        : await this._api.createAddon(payload);
      this.savedAddon = await this._api.getPublicAddon(result.id);
      this.populateForm(this.savedAddon);
      this.editMode = true;
      this.success = "Addon saved and reloaded from the public catalog.";
    } catch (error) {
      this.error =
        (error instanceof HttpErrorResponse || error instanceof AscensionApiError) && error.status === 403
          ? "Only the addon owner can edit this addon."
          : this.getApiError(error, "Unable to save this addon.");
    } finally {
      this.submitting = false;
    }
  }

  private createEmptyForm() {
    return {
      id: "",
      name: "",
      author: "",
      foldersText: "",
      githubRepository: "",
      summary: "",
      description: "",
      thumbnailUrl: "",
      releases: [] as ReleaseForm[],
    };
  }

  private createRelease(): ReleaseForm {
    return { id: "", version: "", channel: "stable", folders: [], foldersText: "", downloadUrl: "", releasedAt: "" };
  }

  private resetForm(): void {
    this.form = this.createEmptyForm();
    this.editMode = false;
    this.error = "";
    this.success = "";
    this.savedAddon = undefined;
    this.validationErrors = {};
  }

  private populateForm(addon: AscensionAddon): void {
    this.form = {
      id: addon.id,
      name: addon.name,
      author: addon.author,
      foldersText: addon.folders.join(", "),
      githubRepository: addon.githubRepository ?? "",
      summary: addon.summary ?? "",
      description: addon.description ?? "",
      thumbnailUrl: addon.thumbnailUrl ?? "",
      releases: (addon.releases ?? []).map((release) => ({ ...release, foldersText: release.folders.join(", ") })),
    };
  }

  private validate(): Record<string, string> {
    const errors: Record<string, string> = {};
    if (!this.form.name.trim()) errors.name = "Name is required.";
    if (!this.form.author.trim()) errors.author = "Author is required.";
    const folders = this.splitFolders(this.form.foldersText);
    if (this.form.githubRepository.trim()) {
      if (!this.normalizeGithubRepository(this.form.githubRepository))
        errors.githubRepository = "Use owner/repository or a GitHub repository URL.";
      if (folders.length === 0) errors.folders = "At least one installed folder is required for a GitHub addon.";
    } else if (this.form.releases.length === 0) {
      errors.releases = "Add at least one release for a manual-release addon.";
    }
    this.form.releases.forEach((release, index) => {
      const prefix = `release-${index}`;
      if (!release.id.trim()) errors[`${prefix}-id`] = "Release ID is required.";
      if (!release.version.trim()) errors[`${prefix}-version`] = "Version is required.";
      if (!release.downloadUrl.trim()) errors[`${prefix}-downloadUrl`] = "Download URL is required.";
      if (
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(release.releasedAt) ||
        Number.isNaN(Date.parse(release.releasedAt))
      )
        errors[`${prefix}-releasedAt`] = "Use an ISO release date.";
      if (this.splitFolders(release.foldersText).length === 0)
        errors[`${prefix}-folders`] = "At least one folder is required.";
    });
    return errors;
  }

  private toPayload(): AscensionAddonPayload {
    const releases = this.form.releases.map(({ foldersText, ...release }) => ({
      ...release,
      folders: this.splitFolders(foldersText),
    }));
    return {
      name: this.form.name.trim(),
      author: this.form.author.trim(),
      folders: this.splitFolders(this.form.foldersText),
      ...(this.form.githubRepository.trim()
        ? { githubRepository: this.normalizeGithubRepository(this.form.githubRepository) }
        : {}),
      ...(releases.length ? { releases } : {}),
      ...(this.form.summary.trim() ? { summary: this.form.summary.trim() } : {}),
      ...(this.form.description.trim() ? { description: this.form.description.trim() } : {}),
      ...(this.form.thumbnailUrl.trim() ? { thumbnailUrl: this.form.thumbnailUrl.trim() } : {}),
      ...(this.editMode ? { id: this.form.id } : {}),
    };
  }

  private splitFolders(value: string): string[] {
    return value
      .split(",")
      .map((folder) => folder.trim())
      .filter(Boolean);
  }

  private normalizeGithubRepository(value: string): string | undefined {
    const repository = value.trim().replace(/\/$/, "");
    if (/^[^/\s]+\/[^/\s]+$/.test(repository)) {
      return repository;
    }

    try {
      const url = new URL(repository);
      const parts = url.pathname.split("/").filter(Boolean);
      return url.hostname === "github.com" && parts.length === 2 ? `${parts[0]}/${parts[1]}` : undefined;
    } catch {
      return undefined;
    }
  }

  private getApiError(error: unknown, fallback: string): string {
    if (error instanceof AscensionApiError && error.apiError) {
      return error.apiError;
    }
    return error instanceof HttpErrorResponse && typeof error.error?.error === "string" ? error.error.error : fallback;
  }
}
