================================================================================
Reclaiming Authentic Social Media

VERSION: v0.2.0 (Prototype)
DATE:    2025-11-30

OVERVIEW

NoAI is a social media platform built on human creativity, direct capture, and
genuine connection. It stands in radical contrast to current AI-driven networks
by enforcing no AI filters, no generative AI, and no opaque algorithmic
manipulation.

The core experience prioritizes authenticity, spontaneity, and human-made
expression.

CORE PRINCIPLES (Human-Made by Default)

Direct Capture Only
All content is intended to be created directly through the device camera.

Tools That Support
Editing features must be basic, assistive, and non-generative
(e.g., crop, light color correction).

Transparent Discovery
The feed is chronological or community-curated, never algorithmically ranked.

Privacy-First Design
Minimal data capture and maximum user control.

CURRENT PROTOTYPE FEATURES (v0.2.0)

This prototype runs in a React Canvas environment and demonstrates the
following functionalities:

[x] AUTHENTIC LOGIN FLOW
- Dedicated Login Screen.
- Visible demo credentials for testing ("demo_user_01").
- Simulates secure entry while remaining accessible for prototype testing.

[x] HUMAN-CENTRIC IMAGE EDITOR
- Direct Capture/Upload: Integrates with device file system (camera).
- Non-Generative Filters: Standard CSS filters (Warm, Cool, B&W, Vintage).
- Hand Drawing: Canvas overlay for manual drawing on photos.
- No Generative AI: Strictly prohibits AI-generated enhancements.

[x] SOCIAL DISCOVERY & GRAPH
- Discover People: Pre-populated list of "Authentic" dummy users.
(e.g., Maya Creative, Liam Analog, Sarah Real).
- Follow Mechanism: Ability to follow/unfollow users.
- Community Signals: Simple "Like" counts without algorithmic weighting.

[x] PERSISTENT PUBLIC FEED
- Real-time updates via Google Cloud Firestore.
- Strictly chronological ordering (Newest first).
- Displays user attribution and timestamps.

[x] RESPONSIVE UI
- Mobile-first design with bottom navigation.
- Adaptive layout for desktop viewing.

ROADMAP (Future Steps)

+--------------------------+---------------------------+-----------------------+
| FEATURE                  | PRINCIPLE                 | STATUS                |
+--------------------------+---------------------------+-----------------------+
| Full User Auth           | Privacy/Authenticity      | [Partially Done]      |
|                          |                           | (Demo Mode active)    |
+--------------------------+---------------------------+-----------------------+
| Real Camera API          | Direct Capture Only       | [Partially Done]      |
|                          |                           | (File Input used)     |
+--------------------------+---------------------------+-----------------------+
| Non-AI Editing Suite     | Tools That Support        | [Implemented v0.2.0]  |
|                          |                           | Filters + Drawing     |
+--------------------------+---------------------------+-----------------------+
| Social Graph             | Genuine Connection        | [Implemented v0.2.0]  |
|                          |                           | Basic Following       |
+--------------------------+---------------------------+-----------------------+
| Transparent Topic Hubs   | Transparent Discovery     | [Planned]             |
+--------------------------+---------------------------+-----------------------+
| Private Data Storage     | Privacy-First Design      | [Planned]             |
+--------------------------+---------------------------+-----------------------+
| In-App Messaging         | Genuine Connection        | [Planned]             |
+--------------------------+---------------------------+-----------------------+

TECHNICAL STACK

Frontend:         React (JSX)

Styling:          Tailwind CSS

State Management: React Hooks (useState, useEffect, useRef)

Database:         Google Cloud Firestore (Real-time, persistent)

Authentication:   Firebase Auth (Anonymous/Custom Token)

================================================================================
END OF README
