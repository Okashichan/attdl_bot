import { $ } from 'bun';
import fs from 'node:fs/promises';

const getLinkType = (link) => {
  if (link.includes('tiktok.com')) return 'tiktok';
  if (link.includes('youtube.com') || link.includes('youtu.be'))
    return 'youtube';
  if (link.includes('twitter.com') || link.includes('x.com')) return 'twitter';
  if (
    link.includes('instagram.com/reel') ||
    link.includes('instagram.com/p') ||
    link.includes('instagram.com/share/reel')
  )
    return 'instagram';
  return null;
};

const getResponceUrl = async (url) => {
  const response = await fetch(url);
  const responceUrl = response?.url ? response.url : 'fuck';

  return responceUrl;
};

const handleTikTokLink = async (url, type = 'message') => {
  if (url.includes('vt.tiktok.com')) url = await getResponceUrl(url);
  if (url.includes('vm.tiktok.com')) url = await getResponceUrl(url);
  if (url.includes('/t/')) url = await getResponceUrl(url);

  let videoId = '';
  const re =
    /(@[a-zA-z0-9]*|.*)(\/.*\/|trending.?shareId=|item_id=|video\/)([\d]*)/gm;

  if (!url.includes('redirect_url=')) videoId = url.split(re)[3];
  else videoId = decodeURIComponent(url).split(re)[3];

  console.log(`TikTok id: ${videoId}`);

  const getAweme = async () => {
    try {
      const out = await $`python request.py ${videoId}`.json();

      return out;
    } catch (e) {
      // console.log(e.stderr.toString())
      console.log('aweme dead');
    }
  };

  const res = await getAweme();

  if (res?.aweme_list[0] === undefined || res?.aweme_list[0] === null) {
    console.log(`handleTikTokLink(${url})|failed to handle api request...`);
    return;
  }

  if (res.aweme_list[0]?.image_post_info?.images) {
    let images = res.aweme_list[0].image_post_info.images.map((el) => {
      return {
        type: 'photo',
        media: el.display_image.url_list[1].includes('.webp')
          ? el.display_image.url_list[2]
          : el.display_image.url_list[1],
      };
    });

    console.log(`   chunk size: ${images.length}`);

    const perChunk = 9; // images limit

    const result = images.reduce((resultArray, item, index) => {
      const chunkIndex = Math.floor(index / perChunk);

      if (!resultArray[chunkIndex]) {
        resultArray[chunkIndex] = [];
      }

      resultArray[chunkIndex].push(item);

      return resultArray;
    }, []);

    return {
      title: res.aweme_list[0].desc,
      images: result,
      song: {
        url: res.aweme_list[0].music.play_url.uri,
        duration: res.aweme_list[0].music.duration,
        title: res.aweme_list[0].music.title,
        author:
          res.aweme_list[0].music.owner_handle.length &&
          res.aweme_list[0].music.owner_handle.length !==
            0 < res.aweme_list[0].music.author.length
            ? res.aweme_list[0].music.owner_handle
            : res.aweme_list[0].music.author,
      },
    };
  }

  return {
    title: res.aweme_list[0]?.desc,
    urls: res.aweme_list[0]?.video.play_addr.url_list,
    cover: res.aweme_list[0]?.video.cover.url_list[0],
    origin_url: res.aweme_list[0]?.share_info.share_url,
    data_size: res.aweme_list[0]?.video.play_addr_size,
  };
};

export const handleYoutubeLink = async (url) => {
  console.log(`Youtube url: ${url}`);

  const MAX_BYTES = 50 * 1000 * 1000; // Telegram Bot API upload limit (50 MB)
  const TIMEOUT = '90s';

  // H.264 (avc1) + AAC (mp4a) only: plays on Telegram Android's hardware decoders.
  // yt-dlp tries alternatives left to right and, inside each one, takes the best
  // format that passes the filters. The size filter therefore steps the quality
  // down (1080p -> 720p -> 480p ...) until the video fits.
  // Formats with unknown size are excluded by the "<" filters.
  const FORMAT = [
    'bv*[vcodec^=avc1][filesize<40M]+ba[acodec^=mp4a]', // leaves headroom for audio
    'bv*[vcodec^=avc1][filesize_approx<40M]+ba[acodec^=mp4a]', // same, when only an estimate exists
    'b[vcodec^=avc1][acodec^=mp4a][filesize<45M][protocol^=http]', // progressive fallback (usually 360p)
  ].join('/');

  // Unique dir per call so concurrent downloads don't delete each other's files.
  // yt-dlp creates the directory itself.
  const dir = `./downloads/${Bun.randomUUIDv7()}`;
  const cleanup = async () => {
    await Bun.$`rm -rf ${dir}`.quiet().nothrow();
  };

  try {
    const proc = Bun.spawn(
      [
        'timeout',
        TIMEOUT,
        'yt-dlp',
        '--quiet',
        '--no-warnings',
        '--no-playlist',
        '-f',
        FORMAT,
        '--merge-output-format',
        'mp4',
        '--postprocessor-args',
        'Merger+ffmpeg:-movflags +faststart',
        '-o',
        `${dir}/%(id)s.%(ext)s`,
        '--print-json',
        '--',
        url,
      ],
      { stdout: 'pipe', stderr: 'pipe' },
    );

    // Read both streams while waiting for exit, otherwise a full pipe can deadlock.
    const [stdout, stderr, exitCode] = await Promise.all([
      proc.stdout.text(),
      proc.stderr.text(),
      proc.exited,
    ]);

    if (exitCode !== 0) {
      console.log(stderr);
      await cleanup();
      if (exitCode === 124) return { error: 'timeout' };
      if (/Requested format is not available/i.test(stderr))
        return { error: 'too_big' };
      return { error: 'failed' };
    }

    const out = JSON.parse(stdout);

    // After a merge, `filename` can point at a pre-merge name; filepath is reliable.
    const path = out.requested_downloads?.[0]?.filepath ?? out.filename;
    const file = Bun.file(path);

    if (!(await file.exists())) {
      console.log(`Expected output file not found: ${path}`);
      await cleanup();
      return { error: 'failed' };
    }

    // Video size was filtered, audio wasn't, so verify the final file.
    if (file.size > MAX_BYTES) {
      await cleanup();
      return { error: 'too_big', title: out.title };
    }

    return {
      path,
      title: out.title,
      width: out.width,
      height: out.height,
      duration: out.duration,
      cleanup, // call after you've uploaded the file: await res.cleanup()
    };
  } catch (e) {
    console.log(e);
    await cleanup();
    return { error: 'failed' };
  }
};

const handleTwitterLink = async (url) => {
  const postId = (url.match(/\/status\/(\d+)/) || [])[1];
  console.log(`Twitter post id: ${postId}`);

  const res = await fetch(`https://api.vxtwitter.com/Twitter/status/${postId}`)
    .then((res) => res.json())
    .catch((e) => console.log(e));

  if (res?.hasMedia === false) return;

  if (res?.mediaURLs?.length < 1) return;

  if (
    res?.mediaURLs?.length >= 1 &&
    res?.mediaURLs.at(-1)?.includes('video.twimg.com')
  ) {
    return {
      video: res.media_extended.at(-1).url,
      thumb: res.media_extended.at(-1).thumbnail_url,
      text: res.text.replace(/https:\/\/t\.co\/\S+/g, ''),
    };
  }

  if (
    res?.mediaURLs?.length >= 1 &&
    res?.mediaURLs.at(-1)?.includes('pbs.twimg.com')
  ) {
    return {
      images: res.media_extended.map((el) => {
        return {
          type: 'photo',
          media: el.url,
        };
      }),
      text: res.text.replace(/https:\/\/t\.co\/\S+/g, ''),
    };
  }
};

const handleInstagramLink = async (url) => {
  console.log(`Instagram id: ${url}`);

  const getDirectUrl = async () => {
    try {
      const out = await $`timeout 15s yt-dlp \
                -f "best[ext=mp4]/best" \
                --no-download \
                --print-json \
                --skip-download \
                ${url}`.json();

      return out;
    } catch (e) {
      console.log(e.stderr?.toString?.() ?? e);
      return null;
    }
  };

  const info = await getDirectUrl();

  if (!info) {
    return null;
  }

  // top-level `url` is present for single-format extractions;
  // fall back to the best entry in `formats` if not
  const directUrl =
    info.url ??
    info.requested_downloads?.[0]?.url ??
    info.formats?.[info.formats.length - 1]?.url;

  return {
    url: directUrl,
    text: info.description,
    thumbnail: info.thumbnail,
    duration: info.duration,
  };
};

export default {
  getLinkType,
  handleTikTokLink,
  handleYoutubeLink,
  handleTwitterLink,
  handleInstagramLink,
};
