# Moqawil standalone Android release

## Scope and current status

The existing Expo application can be compiled as a standalone Android app.
Expo Go is a preview host, not a runtime requirement of a correctly built release.
No UI, database, application features, SDK version, package identifier, signing
credentials, or existing hosting commands were changed for this configuration.
No signed binary has been produced or device-tested by this configuration change.

The authoritative Android package in app.json is com.moqawil.om.
Before any build, compare this against the existing Google Play Internal Testing
listing. Stop on a mismatch: do not rename the package to resolve it.

## Why the existing preview uses Expo Go

- The dev script starts Expo's Metro development server.
- The existing build script produces Expo Go bundles and manifests, not a native
  Android application. Its production web landing page links to Expo Go.
- The workspace-root eas.json contains a developmentClient-enabled development
  profile. This is a build option, not evidence that an installed application is
  a Dev Client. This application does not currently depend on expo-dev-client.
- Publishing that landing page or exporting JavaScript is not equivalent to
  compiling an Android release.

## Release configuration

Use artifacts/moqawil-app as the app root. Its eas.json extends the existing
workspace-root eas.json, preserving its CLI, versioning, and other configuration.

| Profile | Output | Distribution | Development client |
| --- | --- | --- | --- |
| production | Android App Bundle (.aab) | Google Play | Disabled |
| preview | Installable Android package (.apk) | Internal/direct testing | Disabled |

Both profiles select the production build environment. The root production
profile's remote version source and auto-increment remain inherited. The preview
profile is a release APK, not an Expo Go or Dev Client build.

## Mandatory checks before building

1. The existing Google Play Internal Testing release was built with PWABuilder,
   not Expo/EAS. A new Expo project is allowed for this app, but it is not yet
   linked in app.json. Confirm its project ID and linked source repository
   before requesting a build. Do not create a new Google Play listing.
2. Import and use the EXISTING PWABuilder upload credential through a secure
   build-service credential flow. No local Android signing files were found
   during inspection. Do not generate or replace the signing key. Compare its
   upload certificate fingerprint with Play Console's App integrity information.
3. Confirm the current highest Play versionCode and the existing remote build
   version counter. A new upload must have a higher versionCode. Do not assume
   the local value of 1 represents the published version.
4. In the production build environment, provide EXPO_PUBLIC_DOMAIN as the
   publicly reachable HTTPS backend hostname WITHOUT the protocol or a trailing
   slash. It must not be a preview/dev host.
5. Provide EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY for the existing production Clerk
   instance. Do not place Clerk secret keys or database credentials in the app.
   The dev script's environment assignments do not carry over to native builds.
6. Verify any existing Firebase/FCM Android configuration for notifications and
   the production identity configuration. These cannot be inferred from an
   absent local credential file. Preserve existing external configuration.

## How to request the two artifacts

In the managed Android build service, select this app root, Android, and the
preview profile for the APK. A future production-profile AAB is separate work.
Use the new Expo project linked to this source and the previously used
PWABuilder upload key. If the service offers to create a new signing key, stop.

A cloud build returns its artifact download URL; it does not automatically
create a file in this workspace. Download the successful artifacts before
claiming an output location. An AAB is uploaded to Play Console, not installed
directly on a phone. Install the release APK for direct testing.

No managed Android build was triggered by this change. If no Android build
action is available in the current session, the build remains blocked; changing
JSON alone does not produce a signed artifact.

## Acceptance checks

The release includes its JavaScript bundle and native runtime, and should open
from the Android launcher without Expo Go or a Metro/development server.
Network-backed features still require internet access and the production API.

Test on a phone without Expo Go, with the development server stopped: cold
launch, sign-in, navigation, location, uploads, external phone/WhatsApp links,
and notifications. Verify the installed package/version and signing certificate.

An APK signed with the upload key may NOT update an installation from Google
Play, which uses the Play app-signing key. Prefer a separate test device/profile;
do not casually uninstall the existing app because that removes its local data.
Use Play Internal Testing to verify updates signed by Google Play.