# Xiaozhi AI custom Assets single-page application

## Application purpose

The customized theme of Xiaozhi AI voice dialogue box (including wake word model, emoticon package, text font, chat background), generate and export assets.bin file online.

## Functional design

Users need to customize an assets.bin file, which is divided into 3 steps.
- Step 1: Select chip model, screen type and resolution
- Step 2: Theme design (use multiple tabs to complete the configuration of different projects)
- Step 3: List of content to be packaged and generated and generate button

## Detailed page function

### Select chip model, screen type and resolution

Provides some common board shortcut selection configuration items, such as

- Lichuang Practical ESP32-S3, configured as esp32s3, LCD 320x240, RGB565
- ESP-BOX-3, configured as esp32s3, LCD 320x240, RGB565
- Wuming Technology·Xingzhi 1.54 TFT, configured as esp32s3, LCD 240x240, RGB565
- Surfer C3 1.14 TFT, configured as esp32c3, LCD 240x135, RGB565

You can also customize the chip (you can choose esp32s3, esp32c3, esp32p4, esp32c6), customize the resolution size, and the color currently only supports 16-bit RGB565

### Theme design

#### Tab 1: Wake word configuration

For C3/C6 chips, only the wake word model of WakeNet9s is supported.
For S3/P4 chips, only the wake word model of WakeNet9 is supported.

The list is as follows, the first column is the wake word name, and the other columns are values.

|wake words       |             WakeNet9s           |  WakeNet9              | 
|:--------------- | :------------------------------:| :---------------------:| 
|Hi, Espressif Systems | wn9s_hilexin | wn9_hilexin |
|Hi,ESP           |  wn9s_hiesp                      | wn9_hiesp              | 
|Hi Xiaozhi | wn9s_nihaoxiaozhi | wn9_nihaoxiaozhi_tts |
|Hi,Jason         |   wn9s_hijason_tts2              | wn9_hijason_tts2       |
|Hello meow companion | | wn9_nihaomiaoban_tts2 |
|Classmate Xiaoai | | wn9_xiaoaitongxue |
|Hi,M Five        |                                  | wn9_himfive            | 
|Alexa            |                                  | wn9_alexa              | 
|Jarvis           |                                  | wn9_jarvis_tts         | 
|Computer         |                                  | wn9_computer_tts       |
|Hey,Willow       |                                  | wn9_heywillow_tts      | 
|Sophia           |                                  | wn9_sophia_tts         |
|Mycroft          |                                  | wn9_mycroft_tts        |
|Hey,Printer      |                                  | wn9_heyprinter_tts     |
|Hi,Joy           |                                  | wn9_hijoy_tts          |
|Hey,Wand         |                                  | wn9_heywanda_tts       |
|Astrolabe        |                                  | wn9_astrolabe_tts      |
|Hey,Ily          |                                  | wn9_heyily_tts2        |
|Hi,Jolly         |                                  | wn9_hijolly_tts2        |
|Hi,Fairy         |                                  | wn9_hifairy_tts2        |
|Blue Chip        |                                  | wn9_bluechip_tts2        |
|Hi,Andy          |                                  | wn9_hiandy_tts2        |
|Hi,Wall E/Hi,WallE| | wn9_hiwalle_tts2 |
|Hello Xiaoxin | | wn9_nihaoxiaoxin_tts |
|Xiaomei classmate | | wn9_xiaomeitongxue_tts |
|Hi, Xiaoxing | | wn9_hixiaoxing_tts |
|小龙小龙 | | wn9_xiaolongxiaolong_tts |
|Miao Miao Classmate | | wn9_miaomiatongxue_tts|
|Hi, meow meow | | wn9_himiaomiao_tts |
|Hi,Lily/Hi,Lily | | wn9_hilili_tts |
|Hi,Telly/Hi,Telly | | wn9_hitelly_tts |
|Ohama Xiaobin/Xiaobing Xiaobing| | wn9_xiaobinxiaobin_tts |
|Hi, Xiaowu | | wn9_haixiaowu_tts |
|Little duck duck | | wn9_xiaoyaxiaoya_tts2 |
|Linaiban | | wn9_linaiban_tts2 |
|Little Crispy Pork | | wn9_xiaosurou_tts2 |
|Classmate Xiaoyu | | wn9_xiaoyutongxue_tts2 |
|Classmate Xiao Ming | | wn9_xiaomingtongxue_tts2|
|xiaokangtongxue_tts2|
|small arrowsmall arrow| | wn9_xiaojianxiaojian_tts2|
|xiaotexiaote| | wn9_xiaotexiaote_tts2|
|Hello Xiaoyi | | wn9_nihaoxiaoyi_tts2|
|Nihao Baiying | | wn9_nihaobaiying_tts2|
|小鹿小鹿 | | wn9_xiaoluxiaolu_tts2|
|Hello Dongdong | | wn9_nihaodongdong_tts2|
|Hello Xiaoan | | wn9_nihaoxiaoan_tts2|
|Hello Xiaomai | | wn9_ni3hao3xiao3mai4_tts2|

Wake word reference `spiffs_assets/pack_model.py` Pack the corresponding model directory under `share/wakenet_model` into srmodels.bin

#### Tab 2: Font configuration

Users can choose preset fonts (located in the `share/fonts` directory) without the font creation process. Commonly used fonts include:
- font_puhui_14_1: Alibaba inclusive font, covering 7000 commonly used characters, font size 14px, bpp1
- font_puhui_16_4: Alibaba inclusive font, covering 7000 commonly used characters, font size 16px, bpp4
- font_puhui_20_4: Alibaba inclusive font, covering 7000 commonly used characters, font size 20px, bpp4
- font_puhui_30_4: Alibaba inclusive font, covering 7000 commonly used characters, font size 30px, bpp4

Users can also upload custom fonts:
- You need to select a local font file. Currently, TTF and WOFF formats are supported.
- Select the font size (the range is limited to 8-80, commonly used are 14, 16, 20 and 30), select bpp (the range is 1, 2, 4)
- Select character set (GB2312 7445 characters, DeepSeek R1 7405 characters), DeepSeek R1 is selected by default

Custom font reference `lv_font_conv/lib/convert.js` is converted into cbin format, and the converted file is named font_[font name]_[font size]_[BPP].bin

### Tab 3: Expression collection

A common emoticon collection contains a total of 21 pictures, one of which is a neutral default emoticon, and the rest are emoticons expressing different emotions.
The Emoji corresponding to different expressions are as follows:

| 😶 | neutral      |
| 🙂 | happy        |
| 😆 | laughing     |
| 😂 | funny        |
| 😔 | sad          |
| 😠 | angry        |
| 😭 | crying       |
| 😍 | loving       |
| 😳 | embarrassed  |
| 😯 | surprised    |
| 😱 | shocked      |
| 🤔 | thinking     |
| 😉 | winking      |
| 😎 | cool         |
| 😌 | relaxed      |
| 🤤 | delicious    |
| 😘 | kissy        |
| 😏 | confident    |
| 😴 | sleepy       |
| 😜 | silly        |
| 🙄 | confused     |

Users can choose preset emoticon packs. The preset emoticons include:
- Twemoji 32x32 PNG (located in `share/twemoji32`)
- Twemoji 64x64 PNG (located in `share/twemoji64`)

Users can also customize emoticons:
- You need to set a uniform image size width x height, which cannot be larger than the screen resolution.
- Choose between dynamic image (GIF) or static transparent background image (PNG) format
- A default image must be provided as a neutral expression (the size will be automatically adapted to widght x height)
- Other emoticons are optional. If the user does not modify other emoticon images, neutral emoticons will be displayed by default.

### Tab 4: Chat background

The background is divided into two configurations: light mode and dark mode. The default is color configuration.
- Default light mode is #ffffff, dark mode is #121212

Users can modify the default colors or add static images as backgrounds.
The static pictures can be two different pictures, or they can be configured as one picture.
The background image will automatically adapt to the size of the screen resolution. The format is usually an RGB565 bitmap with a 64-byte header and the content is lv_image_dsc_t.

### Generate assets.bin

During the theme design process, users can click the generate button in the upper right corner at any time to display a list of resources to be packaged through a pop-up window.
After the user clicks "OK", it starts waiting for generation. If the user customizes the font file, it will take a long time to create the font. The production results can be cached and regenerated faster.

The function of generating assets.bin locally on the browser side has now been implemented without the need for a back-end API.

## Technical implementation

### Generate assets.bin on the browser side

The project now uses a fully browser-based local build scheme:

1. **WakenetModelPacker.js** - imitates the function of `pack_model.py`, and packages the wake word model on the browser side as srmodels.bin
2. **SpiffsGenerator.js** - imitates the function of `spiffs_assets_gen.py` and generates the final assets.bin file
3. **AssetsBuilder.js** - Coordinates various modules and imitates the resource processing process of `build.py`

### Generation process

1. Load user configuration
2. Process font files (preset fonts or custom font conversion)
3. Load and package the wake word model from `share/wakenet_model/`
4. Process emoticon pictures (default or customized)
5. Process the background image and convert it to RGB565 format
6. Generate index.json index file
7. Use SPIFFS format to package all files into assets.bin

### Resource file structure

The generated assets.bin contains the index file index.json, the content of which is roughly as follows:

Example 1:
```json
{
    "version": 1,
    "chip_model": "esp32s3",
    "display_config": {
        "width": 320,
        "height": 240,
        "monochrome": false,
        "color": "RGB565"
    },
    "srmodels": "srmodels.bin",
    "text_font": "font_puhui_common_30_4.bin",
    "skin": {
        "light": {
            "text_color": "#000000",
            "background_color": "#FFFFFF",
            "background_image": "background_light.raw"
        },
        "dark": {
            "text_color": "#FFFFFF",
            "background_color": "#121212",
            "background_image": "background_dark.raw"
        }
    },
    "emoji_collection": [
        {
            "name": "sleepy",
            "file": "sleepy.png"
        },
        ...
    ]
}
```

Example 2:
```json
{
    "version": 1,
    "chip_model": "esp32c3",
    "display_config": {
        "width": 240,
        "height": 240,
        "monochrome": false,
        "color": "RGB565"
    },
    "srmodels": "srmodels.bin",
    "text_font": "font_puhui_common_16_4.bin",
    "skin": {
        "light": {
            "text_color": "#000000",
            "background_color": "#FFFFFF",
        },
        "dark": {
            "text_color": "#FFFFFF",
            "background_color": "#121212"
        }
    },
    "emoji_collection": [
        {
            "name": "sleepy",
            "file": "sleepy.png"
        },
        ...
    ]
}
```

