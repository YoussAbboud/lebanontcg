import { Config } from '@remotion/cli/config';
import { existsSync } from 'node:fs';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
Config.setConcurrency(4);
Config.setDelayRenderTimeoutInMilliseconds(600000);

// Build-container only (skipped on a normal machine): it can't download Remotion's headless shell, so it uses the one
// already installed, and its software GL (swangle) wedges under parallel tabs, so it renders on legacy SwiftShader.
const CONTAINER_SHELL = '/root/.cache/hyperframes/chrome/chrome-headless-shell/linux-152.0.7977.30/chrome-headless-shell-linux64/chrome-headless-shell';
if (existsSync(CONTAINER_SHELL)) {
  Config.setBrowserExecutable(CONTAINER_SHELL);
  Config.setChromiumOpenGlRenderer('swiftshader');
}
