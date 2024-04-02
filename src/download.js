import { unlink, createWriteStream, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'

const generateRandomFileName = (extension) => {
    const randomString = randomBytes(6).toString('hex')
    return `${randomString}${extension}`
}

const cleanupFile = (filePath) => {
    unlink(filePath, (err) => {
        if (err) console.error(`Failed to delete file: ${err}`)
    })
}

const downloadFile = async (url, downloadDir) => {
    const response = await fetch({
        url: url,
        responseType: 'stream',
    })

    const fileExtension = url.includes('.webp') ? '.webp' : '.jpg'
    const randomFileName = generateRandomFileName(fileExtension)
    const downloadPath = join(downloadDir, randomFileName)

    const writer = createWriteStream(downloadPath)

    return new Promise((resolve, reject) => {
        response.data.pipe(writer)
        writer.on('finish', () => {
            resolve(downloadPath)
            setTimeout(() => {
                cleanupFile(downloadPath);
            }, 5 * 60 * 1000)
        });
        writer.on('error', reject)
    })
}

const downloadFiles = async (urlList, downloadDir) => {
    const downloadedFilePaths = []

    if (!existsSync(downloadDir)) {
        mkdirSync(downloadDir, { recursive: true })
    }

    for (const url of urlList) {
        try {
            const filePath = await downloadFile(url, downloadDir)
            downloadedFilePaths.push(filePath)
        } catch (error) {
            console.error(`Failed to download ${url}: ${error.message}`)
        }
    }

    return downloadedFilePaths
}

const download = async (url) => {
    let res = await fetch(url)
        .then((res) => res.arrayBuffer())
        .catch((err) => console.log(`download(${url})|failed to download video...`))

    return Buffer.from(res, 'utf-8')
}

export default {
    downloadFiles,
    download
}