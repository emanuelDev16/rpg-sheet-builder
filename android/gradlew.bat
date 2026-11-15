@rem
@rem Copyright 2015 the original author or authors.
@rem
@rem Licensed under the Apache License, Version 2.0 (the "License");
@rem you may not use this file except in compliance with the License.
@rem You may obtain a copy of the License at
@rem
@rem      https://www.apache.org/licenses/LICENSE-2.0
@rem
@rem Unless required by applicable law or agreed to in writing, software
@rem distributed under the License is distributed on an "AS IS" BASIS,
@rem WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
@rem See the License for the specific language governing permissions and
@rem limitations under the License.
@rem
@rem SPDX-License-Identifier: Apache-2.0
@rem

@if "%DEBUG%"=="" @echo off
@rem ##########################################################################
@rem
@rem  gradlew startup script for Windows
@rem
@rem ##########################################################################

@rem Set local scope for the variables, and ensure extensions are enabled
setlocal EnableExtensions

set DIRNAME=%~dp0
if "%DIRNAME%"=="" set DIRNAME=.
@rem This is normally unused
set APP_BASE_NAME=%~n0
set APP_HOME=%DIRNAME%

@rem Resolve any "." and ".." in APP_HOME to make it shorter.
for %%i in ("%APP_HOME%") do set APP_HOME=%%~fi

@rem Add default JVM options here. You can also use JAVA_OPTS and GRADLE_OPTS to pass JVM options to this script.
set DEFAULT_JVM_OPTS="-Xmx64m" "-Xms64m"

@rem Find java.exe
if defined JAVA_HOME goto findJavaFromJavaHome

set JAVA_EXE=java.exe
%JAVA_EXE% -version >NUL 2>&1
if %ERRORLEVEL% equ 0 goto execute

@rem Recover JAVA_HOME from Windows Registry when running in a shell with stale environment variables
call :tryRegistryJavaHome "HKCU\Environment"
if defined JAVA_HOME goto findJavaFromJavaHome
call :tryRegistryJavaHome "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment"
if defined JAVA_HOME goto findJavaFromJavaHome

@rem Fallback: probe common Windows JDK / JBR locations (preferring JDK 17 / 21)
for /d %%d in (
    "%ProgramFiles%\Eclipse Adoptium\jdk-17*"
    "%ProgramFiles%\Eclipse Adoptium\jdk-21*"
    "%ProgramFiles%\Eclipse Adoptium\jdk-*"
    "%ProgramFiles%\Java\jdk-17*"
    "%ProgramFiles%\Java\jdk-21*"
    "%ProgramFiles%\Java\jdk-*"
    "%ProgramFiles%\Microsoft\jdk-17*"
    "%ProgramFiles%\Microsoft\jdk-21*"
    "%ProgramFiles%\Microsoft\jdk-*"
    "%ProgramFiles%\Android\Android Studio\jbr*"
    "%ProgramFiles%\JetBrains\IntelliJ IDEA*\jbr*"
    "%USERPROFILE%\.jdks\*"
) do (
    if exist "%%~fd\bin\java.exe" (
        set "JAVA_HOME=%%~fd"
        goto findJavaFromJavaHome
    )
)

echo. 1>&2
echo ERROR: JAVA_HOME is not set and no 'java' command could be found in your PATH. 1>&2
echo. 1>&2
echo Please set the JAVA_HOME variable in your environment to match the 1>&2
echo location of your Java installation. 1>&2

goto fail

:tryRegistryJavaHome
for /f "tokens=1,2,*" %%a in ('reg query "%~1" /v JAVA_HOME 2^>NUL ^| findstr /I "JAVA_HOME"') do (
    call :checkCandidateJavaHome "%%c"
)
exit /b 0

:checkCandidateJavaHome
if defined JAVA_HOME exit /b 0
set "CANDIDATE_JAVA_HOME=%~1"
if not defined CANDIDATE_JAVA_HOME exit /b 0
set "CANDIDATE_JAVA_HOME=%CANDIDATE_JAVA_HOME:"=%"
if "%CANDIDATE_JAVA_HOME%"=="" exit /b 0
if "%CANDIDATE_JAVA_HOME:~-1%"=="\" set "CANDIDATE_JAVA_HOME=%CANDIDATE_JAVA_HOME:~0,-1%"
if "%CANDIDATE_JAVA_HOME:~-1%"=="/" set "CANDIDATE_JAVA_HOME=%CANDIDATE_JAVA_HOME:~0,-1%"
if exist "%CANDIDATE_JAVA_HOME%\bin\java.exe" set "JAVA_HOME=%CANDIDATE_JAVA_HOME%"
set "CANDIDATE_JAVA_HOME="
exit /b 0

:findJavaFromJavaHome
if not defined JAVA_HOME goto failInvalidJavaHome
set "JAVA_HOME=%JAVA_HOME:"=%"
if "%JAVA_HOME%"=="" goto failInvalidJavaHome
if "%JAVA_HOME:~-1%"=="\" set "JAVA_HOME=%JAVA_HOME:~0,-1%"
if "%JAVA_HOME:~-1%"=="/" set "JAVA_HOME=%JAVA_HOME:~0,-1%"
set "JAVA_EXE=%JAVA_HOME%\bin\java.exe"

if exist "%JAVA_EXE%" goto execute

:failInvalidJavaHome
echo. 1>&2
echo ERROR: JAVA_HOME is set to an invalid directory: %JAVA_HOME% 1>&2
echo. 1>&2
echo Please set the JAVA_HOME variable in your environment to match the 1>&2
echo location of your Java installation. 1>&2

goto fail

:execute
@rem Setup the command line
"%JAVA_EXE%" %DEFAULT_JVM_OPTS% %JAVA_OPTS% %GRADLE_OPTS% "-Dorg.gradle.appname=%APP_BASE_NAME%" -jar "%APP_HOME%\gradle\wrapper\gradle-wrapper.jar" %*
if %ERRORLEVEL% equ 0 goto mainEnd

:fail
rem Set variable GRADLE_EXIT_CONSOLE if you need the _script_ return code instead of
rem having the cmd.exe /c exit 1 terminate the caller's interactive shell.
if %ERRORLEVEL% equ 0 (set "_GRADLE_EXIT_CODE=1") else (set "_GRADLE_EXIT_CODE=%ERRORLEVEL%")
if not "%GRADLE_EXIT_CONSOLE%"=="" exit %_GRADLE_EXIT_CODE%
exit /b %_GRADLE_EXIT_CODE%

:mainEnd
if "%OS%"=="Windows_NT" endlocal
