# Privacy Policy for ToddlerCam (KidsCam)

**Effective Date:** September 9, 2026  
**Developer:** HEJI TECHNOLOGY LLC (`com.hejitech.kidscam`)  
**App Category:** Kids (Ages 5 and Under) & Photo / Video  

---

### 1. Introduction & Commitment to Child Safety
HEJI TECHNOLOGY LLC ("we", "our", or "us") built **ToddlerCam** as a child-safe, privacy-by-design dual camera and parent remote control application designed specifically for toddlers, babies, and young children. We strictly respect the privacy of children and families.

ToddlerCam complies with:
- The **Children's Online Privacy Protection Act (COPPA)**
- The **General Data Protection Regulation (GDPR / GDPR-K)**
- Apple's **App Store Review Guidelines for the Kids Category (Guideline 1.3 & 5.1.4)**

---

### 2. Zero Data Collection
**ToddlerCam does NOT collect, transmit, store, or sell any personal data.** The only exception is feedback a parent chooses to send (section 2a), which is off by default.
- **No Personal Information:** We do not collect names, email addresses, phone numbers, birthdates, locations, or identifiers.
- **No Accounts or Logins:** The app functions 100% locally on your devices without requiring any account or registration.
- **No Third-Party SDKs or Trackers:** There are NO advertising frameworks, NO tracking analytics (e.g. Firebase, AppsFlyer, Mixpanel), and NO third-party SDKs embedded in ToddlerCam (FeedbackKit, below, is our own feedback tool).
- **No Internet Transmission:** Camera streams, photos, audio effects, and watch communications never touch any external server or cloud service.

---

### 2a. Optional Parent Feedback (Off by Default)
In **Parent Settings** (behind the parental gate), a parent can turn on **Shake to Send Feedback**. Only then does shaking the iPhone open a feedback form. If the parent submits it, ToddlerCam sends a screenshot of the screen you shook from (you can mark it up or cover parts of it first), the note you type, and the app version, device model, iOS version and language, plus a random identifier created on the device so the app can tell you when the problem you reported is fixed. Reports go to FeedbackKit, our own feedback service, and are used only to fix the app; we never sell or share them. Nothing is sent unless you press send. Turning the setting off stops it. Leave it off while your toddler holds the phone.

### 3. Device Permissions & Usage

#### A. Camera (`NSCameraUsageDescription`)
- **Purpose:** Used exclusively to display real-time video feeds from the front and rear cameras and to capture photos.
- **Processing:** All camera processing occurs entirely in real time on the device using Apple's `AVFoundation` framework. No video frames or biometric face recognition data are ever stored or uploaded.

#### B. Photo Library (`NSPhotoLibraryAddUsageDescription` & `NSPhotoLibraryUsageDescription`)
- **Purpose:** Allows the app to save captured dual photos to your Apple Photos library and allows parents in the Parent Zone to view recent photos or create Apple Watch photo faces.
- **Security:** Photos remain in your private device storage and Apple iCloud library (governed by your Apple ID privacy settings). We have zero access to your photo library outside of the explicit user-triggered save action.

#### C. Microphone (`NSMicrophoneUsageDescription`)
- **Purpose:** Requested by system camera frameworks when configuring dual-camera video feeds and audio effects. ToddlerCam does not record ambient conversations or store audio recordings.

#### D. Apple Watch Connectivity (`WatchConnectivity` / `WCSession`)
- **Purpose:** Enables the Apple Watch companion app to communicate directly with the paired iPhone to trigger the camera shutter, play toddler attention-grabber sounds, and review the last photo thumbnail.
- **Security:** Communication occurs exclusively over Apple's encrypted local Bluetooth and peer-to-peer Wi-Fi channels.

---

### 4. Toddler Protection & Parental Gate
To ensure toddlers cannot accidentally navigate out of the app or change system settings:
- **Parental Gate:** Access to Settings, Gallery, Guided Access tutorials, and external links requires passing an age-appropriate adult challenge (math problem).
- **Guided Access Support:** The app actively guides parents to configure iOS Guided Access to prevent young children from swiping home, switching apps, or pressing hardware buttons.

---

### 5. Advertising & In-App Purchases
- ToddlerCam is completely **AD-FREE**. There are no banner ads, interstitials, rewarded videos, or sponsored content.
- ToddlerCam contains no behavioral targeting or commercial tracking.

---

### 6. Changes to This Privacy Policy
We may update our Privacy Policy from time to time. Any changes will be posted at this URL with an updated effective date.

---

### 7. Contact Us
If you have any questions or suggestions regarding our Privacy Policy, please contact:
- **Email:** `info@hejitech.com`
- **Website:** `https://tianhaoz95.github.io/hejitech-apps/toddlercam/site/`
- **Developer:** HEJI TECHNOLOGY LLC
