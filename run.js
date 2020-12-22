require('dotenv').config();
const _ = require('lodash');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { RSA_X931_PADDING } = require('constants');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function readLineAsync(message) {
  return new Promise((resolve, reject) => {
    rl.question(message, (answer) => {
      resolve(answer);
    });
  });
} 

const targetSites = {
    facebook : "https://www.facebook.com/",
    twitter : "https://twitter.com/login",
    afreeca : "http://afreecatv.com/",
    twitch : "https://www.twitch.tv/",
};


(async() => {
    const csvData = await loadCSV('./list.csv');
    if(csvData == -1) {
        console.error("CSV 파일 로딩 실패");
        return;
    }

    const browser = await puppeteer.launch({
        headless: false,
        executablePath: process.env.BROWSER_PATH
    });

    for(let url of Object.values(targetSites)) {
        const page = await browser.newPage();
        await page.setViewport({
            width : Number(process.env.BROWSER_HEIGHT),
            height: Number(process.env.BROWSER_WIDTH)
        });
        //링크로 이동
        await page.goto(url, {'waitUntil':'load'});
        await page.waitForTimeout(1500);
        await login(page, url);

        for (let i=0; i<csvData.length; i++) {
            let log = csvData[i];
            //검색버튼 클릭
            const searchInputHandle = await page.$x(getXpath(url));

            //검색어 입력
            await searchInputHandle[0].focus();
            await page.keyboard.down('Control');
            await page.keyboard.press('A');
            await page.keyboard.up('Control');
            await page.keyboard.press('Backspace'); //기존 입력 제거
            await searchInputHandle[0].type(log[0]);
            if(process.env.SEARCH_MIDDLE_IF_EXISIT == "true" && log[1] != '') {
                await searchInputHandle[0].type(` ${log[1]}`);
            }
            await searchInputHandle[0].type(String.fromCharCode(13));  //엔터 입력
            await page.waitForTimeout(2000);
            for(let j of [...Array(Number(process.env.SCROLL_HOW_MANY)).keys()]) {
                //스크롤링
                await page.evaluate(`window.scrollBy({
                    top: ${process.env.SCROLL_HEIGHT},
                    left: 0,
                    behavior: 'smooth'
                })`);
                await page.waitForTimeout(Number(process.env.SCROLL_INTERVAL_MS));
            }

            //사용자 입력 대기
            const userInput = await readLineAsync("검사 결과 입력후 엔터를 눌러주세요 > ");
            log.push(userInput);
            saveToCSV("./tmp.csv", csvData);
            console.log("\n파일 임시저장 완료");
        }
        await page.close();
    }
    saveToCSV("./done.csv", csvData);
    console.log("\n 작업 종료, 결과 순서 = ", Object.keys(targetSites), "\n");
    await browser.close();
    return;
})();

function getXpath(url) {
    //트위치 트위터 페이스북 아프리카
    switch (url) {
        case targetSites.facebook:
            return '//input[@type="search"]';
        case targetSites.twitter:
            return '//input[@aria-label="Search query"]';
        case targetSites.afreeca:
            return '//input[@id="szKeyword"]';
        case targetSites.twitch:
            return '//input[@autocomplete="twitch-nav-search"]';
    }
}

async function login(page, url) {
    switch (url) {
        case targetSites.facebook:
            await page.type("#email", process.env.FACEBOOK_ID, { delay: 30 })
            await page.type("#pass", process.env.FACEBOOK_PASSWORD, { delay: 30 })
            await page.type("#pass", String.fromCharCode(13));  //엔터 입력
            await page.waitForTimeout(5000);
            break;
        case targetSites.twitter:
            const idHandle = await page.$x('//input[@type="text"]');
            const pwHandle = await page.$x('//input[@type="password"]');
            await idHandle[0].type(process.env.TWITTER_ID, { delay: 30 });
            await pwHandle[0].type(process.env.TWITTER_PASSWORD, { delay: 30 });
            await pwHandle[0].type(String.fromCharCode(13));
            await page.waitForTimeout(5000);
            break;
        case targetSites.afreeca:
            return;
        case targetSites.twitch:
            return;
    }

    
}

const pageDown = async (page) => {
    const scrollHeight = 'document.body.scrollHeight';
    let previousHeight = await page.evaluate(scrollHeight);
    await page.evaluate(`window.scrollTo(0, ${scrollHeight})`);
    await page.waitForFunction(`${scrollHeight} > ${previousHeight}`, {
      timeout: 30000
    });
};

async function saveToCSV(savePath, data) {
    let csv = data.map((innerArray) => {
        return innerArray.join(',');
    });
    csv = csv.join('\n');
    fs.promises.writeFile(savePath, csv);
}


async function loadCSV(csvPath) {
    if(path == null) {
        return -1;
    }
    
    const filePath = path.resolve(csvPath);

    const data = await fs.promises.readFile(filePath, {encoding : 'utf-8'});
    const rows = data.split('\n');
    const result = rows.map((row, index, array) => {
        return row.split(',');
    })

    return result
}