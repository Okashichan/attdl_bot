const axios = require('axios')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const generateRandomFileName = (extension) => {
    const randomString = crypto.randomBytes(6).toString('hex')
    return `${randomString}${extension}`
}

const cleanupFile = (filePath) => {
    fs.unlink(filePath, (err) => {
        if (err) console.error(`Failed to delete file: ${err}`)
    })
}

const downloadFile = async (url, downloadDir) => {
    const response = await axios({
        method: 'get',
        url: url,
        responseType: 'stream',
    })

    const fileExtension = url.includes('.webp') ? '.webp' : '.jpg'
    const randomFileName = generateRandomFileName(fileExtension)
    const downloadPath = path.join(downloadDir, randomFileName)

    const writer = fs.createWriteStream(downloadPath)

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

    if (!fs.existsSync(downloadDir)) {
        fs.mkdirSync(downloadDir, { recursive: true })
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
    let res = await axios.get(url, { responseType: 'arraybuffer' })
        .catch((err) => console.log(`download(${url})|failed to download video...`))

    return Buffer.from(res.data, 'utf-8')
}

module.exports = {
    downloadFiles,
    download
}