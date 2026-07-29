<p align="center">
  <img src="https://cdn.wowup.io/site/assets/icons/android-chrome-512x512.png" width="200" />
</p>

# WowUp Client Repository

[![WowUp on Discord](https://img.shields.io/static/v1?label=Discord&message=WowUp&color=7289DA)](https://discord.gg/rk4F5aD)
[![WowUp on Patreon](https://img.shields.io/static/v1?label=Patreon&message=WowUp&color=f96854)](https://www.patreon.com/jliddev)

This is the repository for our [WowUp](https://wowup.io) client with [CurseForge](https://curseforge.com) support for Windows, Mac, and Linux.

## WowUp

![image](https://user-images.githubusercontent.com/20467484/150164985-673d02da-e7ec-42aa-b77d-655c8e3117ff.png)

WowUp is the community centered World of Warcraft addon updater. We attempt to bring the addon community together in an easy to use updater application. We have an ever growing list of supported features.

- Support for all major addon sources
- Discover or find new addons across addon sources
- Handle all your different World of Warcraft clients
- Auto updates
- [Companion addon](https://github.com/WowUp/WowUp.Addon)

## Installing

### Latest Releases

The latest WowUp release is always available on our website [wowup.io](https://wowup.io)

### Beta Releases

If you feel like helping us test the latest and greatest changes beta builds are available on [GitHub](https://github.com/WowUp/WowUp/releases)

### Community Support Alternatives

#### [WinGet](https://learn.microsoft.com/en-us/windows/package-manager/winget/)

Ships with Windows 10 and 11.  You can install WowUp With Wago using:

```cmd
winget install wowup.wowup
```

Or Wowup with CurseForge with:

```cmd
winget install wowup.cf
```

#### [Chocolatey](https://chocolatey.org)

You can also install the latest version via Chocolatey package manager:

```cmd
choco install wowup
```

## Adding a Client

WowUp automatically detects installed World of Warcraft clients. To add one manually:

1. Open **Options** from the sidebar and select **Clients**.
2. Click **Add New**.
3. In the file picker, select the game client executable, such as `Ascension.exe`.
4. Confirm the client details and select its default addon channel and auto-update preference.

![WowUp client settings](imgs/wowup-client.png)

## Ascension Addon Authors

![WowUp addon author portal](imgs/wowup-addon-portal.png)

### Publish an Addon

1. Open **Author portal** from the WowUp sidebar.
2. Select **Sign in with GitHub** and authorize WowUp.
3. Enter the addon **Name**, confirm the **Author**, and optionally add a thumbnail, summary, and description.
4. Choose a publishing method:
   - For a GitHub addon, enter its repository as `owner/repository` (or its GitHub URL) and list the installed addon folders, separated by commas.
   - For a manual-release addon, leave **GitHub repository** blank. Select **Add release** and enter the release ID, version, channel, installed folders, ZIP download URL, and ISO 8601 release date.
5. Select **Publish addon**. To update an existing addon, choose it from **Edit an addon**, select **Edit**, make your changes, and select **Save changes**.

### Prepare Release ZIPs

For manual releases, WowUp downloads and extracts the ZIP at the supplied download URL. The ZIP must contain each addon directory at its root, with its `.toc` file inside that directory. For example, `MyAscensionAddon-1.0.0.zip` should contain:

```text
MyAscensionAddon/
MyAscensionAddon/MyAscensionAddon.toc
MyAscensionAddon/...
```

Do not wrap the addon directory in another directory such as `my-repository-1.0.0/`. If an addon contains multiple folders, include each folder at the ZIP root and list every folder in the release's **Folders** field. Ensure the ZIP URL is publicly accessible before publishing.

## Feedback

If you have a question, comment, or request we have several ways you can communicate them.

- Contact me Discord: xzerow
