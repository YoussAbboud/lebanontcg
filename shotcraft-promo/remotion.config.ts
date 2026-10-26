import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
Config.setChromiumOpenGlRenderer('swangle');
Config.setConcurrency(4);
// This container can't download Remotion's own headless shell; use the one already on the machine.
Config.setBrowserExecutable('/root/.cache/hyperframes/chrome/chrome-headless-shell/linux-152.0.7977.30/chrome-headless-shell-linux64/chrome-headless-shell');
Config.setDelayRenderTimeoutInMilliseconds(180000);
