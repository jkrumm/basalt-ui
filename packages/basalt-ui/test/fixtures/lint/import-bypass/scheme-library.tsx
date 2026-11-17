// Fixture: import-boundary/scheme-library
// @invalid
import { useTheme } from 'next-themes'
// @invalid
import { ThemeProvider } from 'next-themes'
// @invalid
import { ThemeProvider, useTheme } from 'remix-themes'
// @invalid
import useDarkMode from 'use-dark-mode'
// @valid
import { setScheme } from 'basalt-ui/core/scheme'
// @valid
import { BasaltProvider } from 'basalt-ui/router'
