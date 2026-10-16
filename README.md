# Panelly

Panelly is an availability-first manga discovery and reading website that helps users find manga with readable chapters available through supported sources.

Users can browse manga, search for titles, view series information, check chapter availability, save titles to their Panel Shelf, track reading progress, and read supported MangaDex chapters directly through the website.

The project was created as my final project for Integrative Programming and Technologies.

## Student

**Lex Panerio**

## Website Category

**Entertainment**

## Project Purpose

Panelly was created from a common problem when discovering manga online: finding an interesting title does not always mean that readable chapters are immediately available on the same platform.

Instead of focusing only on manga discovery, Panelly connects discovery with chapter availability and reading.

The goal is to make the process simpler:

**Discover → Check Availability → Read → Save Progress → Continue Reading**

## Novelty

Panelly uses an **availability-first and account-free approach**.

Instead of only displaying manga based on popularity, title, or genre, Panelly also focuses on whether supported readable chapters are available.

Users do not need to create an account, and the project does not require its own user database.

Bookmarks and reading progress are stored locally in the user's browser using Local Storage.

### Main Differentiators

- Availability-first manga discovery
- Account-free experience
- No user database required
- Local bookmark storage
- Local reading-progress tracking
- Discovery and reading combined in one interface
- Manga information and readable chapters obtained dynamically from supported external APIs

## Features

- Manga search
- Browse manga by genre
- Trending manga
- Recently updated manga
- Readable manga discovery
- Manga detail pages
- Series descriptions and metadata
- Genre and tag information
- Chapter availability checking
- Available chapter list
- Built-in manga reader for supported MangaDex chapters
- Previous chapter navigation
- Next chapter navigation
- Panel Shelf / bookmark feature
- Continue Reading feature
- Reading progress tracking
- Random manga discovery
- Responsive desktop and mobile design
- Loading states
- Empty states
- Error handling

## Technologies Used

- HTML
- CSS
- JavaScript
- Fetch API
- Async / Await
- JSON
- DOM Manipulation
- Local Storage
- AniList API
- MangaDex API
- Jikan API
- Vercel

## External APIs

### AniList API

AniList is used primarily for manga discovery and series information.

It provides information such as:

- Manga titles
- Cover images
- Descriptions
- Genres
- Tags
- Status
- Popularity and other catalog information

### MangaDex API

MangaDex is used to check supported manga availability and retrieve chapters that are available through MangaDex.

For supported chapters, Panelly loads the chapter pages dynamically in its built-in reader.

Panelly does not store manga chapter image files in its own database.

### Jikan API

Jikan is used as an additional source for selected manga information when needed, such as chapter-count information.

## Data and Storage

Panelly gets manga information dynamically from external APIs.

The project does not maintain its own manga database.

User-specific information such as bookmarks and reading progress is stored using the browser's Local Storage.

This means:

- No account is required
- No login is required
- No user database is required
- Bookmarks remain on the browser where they were saved
- Reading progress remains on the browser where it was saved

Clearing browser storage may also remove saved Panel Shelf items and reading progress.

## How Panelly Works

Panelly uses JavaScript and the Fetch API to request manga data from supported external APIs.

The returned JSON data is processed using JavaScript and displayed dynamically through DOM manipulation.

A simplified flow is:

```text
User opens Panelly
        ↓
Panelly requests manga information
        ↓
Manga results are displayed
        ↓
User selects a manga
        ↓
Panelly loads series information
        ↓
Panelly checks MangaDex for matching chapters
        ↓
Available chapters are displayed
        ↓
User opens a supported chapter
        ↓
Chapter pages are loaded in the reader
        ↓
Reading progress is saved locally

Panelly/
├── index.html
├── style.css
├── app.js
├── detail.html
├── detail.css
├── detail.js
├── reader.html
├── reader.js
├── panelly-logo.png
├── api/
│   ├── anilist.js
│   ├── mangadex.js
│   ├── jikan.js
│   └── proxy-image.js
└── README.md
