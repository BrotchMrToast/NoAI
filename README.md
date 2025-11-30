NoAI: Reclaiming Authentic Social Media

Version: v0.1.0 (Prototype)

NoAI is a social media platform built on human creativity, direct capture, and genuine connection. It stands in radical contrast to current AI-driven networks by enforcing no AI filters, no generative AI, and no opaque algorithmic manipulation. The core experience prioritizes authenticity, spontaneity, and human-made expression.

1. Core Principles (Human-Made by Default)

Based on the founding vision, the application adheres to the following non-negotiable principles:

Direct Capture Only: All content is intended to be created directly through the device camera.

Tools That Support: Editing features must be basic, assistive, and non-generative (e.g., crop, light color correction).

Transparent Discovery: The feed is chronological or community-curated, never algorithmically ranked.

Privacy-First Design: Minimal data capture and maximum user control.

2. Current Prototype Functionality (v0.1.0)

This React prototype, running in the Canvas environment, demonstrates the foundational data model and real-time feed mechanism using Google Cloud Firestore.

Features Implemented:

Firebase Authentication: Uses anonymous sign-in to instantly generate a unique userId for each session, allowing interaction with shared data.

Persistent Public Feed: Posts are stored publicly in Firestore, ensuring real-time visibility across all users.

Simulated Direct Capture: The main action button allows users to post a placeholder image (simulating a camera capture) with a basic caption and a timestamp.

Transparent Discovery: The feed is displayed in strict chronological order (orderBy('timestamp', 'desc')), eliminating algorithmic curation.

Community-Led Surfacing: Users can Like posts, with the like count visible, demonstrating a simple, human-driven signal over opaque ranking.

Session ID Display: The full unique userId is displayed on the header for session identification and collaborative testing.

3. Future Roadmap (Next Steps)

The following features are planned to bring the app to full functionality, focusing on authentic social interaction and creative freedom:

Feature

Core Principle Addressed

Description

Full User Authentication

Privacy/Authenticity

Implement full registration and login (Email/Social) to replace anonymous sign-in, enabling persistent profiles and private data.

Real Camera Integration

Direct Capture Only

Integrate with the device's camera API (getUserMedia) to allow live photo/video capture (as opposed to placeholder images).

Non-AI Image Editing Suite

Tools That Support

Implement basic, non-generative editing tools: crop, rotate, brightness, contrast, and manual color filters.

Profile & Social Graph

Genuine Connection

Implement features to add friends and follow people, managing the user's social network and filtering the feed based on these connections.

Transparent Topic Hubs

Transparent Discovery

Create curated, non-algorithmic "Hubs" where users can browse content by human-assigned tags or topics.

Private Data Storage

Privacy-First Design

Implement features using the private user path (/artifacts/{appId}/users/{userId}/...) for settings, saved drafts, and private messages.

In-App Messaging

Genuine Connection

Add a simple, direct messaging feature (DM) for one-to-one communication between connected users.

4. Technical Stack

Frontend: React (JSX)

Styling: Tailwind CSS

State Management: React Hooks (useState, useEffect, useCallback)

Database: Google Cloud Firestore (Real-time, persistent data storage)

Authentication: Firebase Auth (Anonymous/Custom Token)
