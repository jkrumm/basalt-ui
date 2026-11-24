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
import { setScheme } from 'basalt-ui'
// @valid
import { BasaltProvider } from 'basalt-ui/router'
// @invalid
import { useDarkMode } from 'usehooks-ts'
// @invalid
import { useTernaryDarkMode } from 'usehooks-ts'
// @valid
import { useDebounceValue, useMediaQuery } from 'usehooks-ts'
