# Panelly

Panelly is a manga reading and discovery website that allows users to browse manga, search for titles, view series information, check available chapters, and read supported chapters directly through the website.

The project was created as my final project for Integrative Programming and Technologies.

## Student

Ethylhexyl Eve B. Panerio

## Website Category

Entertainment

## Features

- Manga search
- Browse manga by genre
- Trending and recently updated manga
- Manga details page
- Available chapter list
- Built-in manga reader for supported chapters
- Previous and next chapter navigation
- Panel Shelf / bookmark feature
- Continue Reading feature
- Random manga discovery
- Responsive design for desktop and mobile
- Loading and error handling

## Technologies Used

- HTML
- CSS
- JavaScript
- Fetch API
- Async / Await
- JSON
- Local Storage
- AniList API
- MangaDex API
- Jikan API
- Vercel

## Data

Panelly gets manga information dynamically from external APIs.

Local Storage is used to save user bookmarks and reading progress. The project does not require a database.

## How It Works

Panelly sends requests to external APIs using JavaScript Fetch API. The returned data is processed and displayed dynamically on the website using JavaScript and DOM manipulation.

For supported manga chapters, users can open the chapter using Panelly's built-in reader.

## Live Website

https://panelly-delta.vercel.app/

## Project Status

Panelly is currently under development. The main features are working, while additional improvements and interface polishing are still being implemented.

## Repository

This repository contains the source code for Panelly, including the website interface, manga detail pages, reader, and API integration.
