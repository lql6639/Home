<strong><h2>Lovlin の Home</h2></strong>

#### 1、本地部署

```shell
git clone https://github.com/lql6639/Home.git
```

#### 2、安装依赖

```shell
pnpm install
```

- 开发环境

```shell
pnpm run dev
```

- 生产环境

```shell
pnpm run build
```

#### 3、网站字体

采用 `HarmonyOS Sans` 开源字体，采用字体拆分，提升加载速度
（用的哔哩哔哩加速CDN！）

> `https://s1.hdslb.com/bfs/static/jinkela/long/font/regular.css`

#### 4、网站背景

- 1.随机动漫背景

> `https://api.imlazy.ink/img`

- 2.可以在 public/home-image 中修改网站背景

> 如果想要添加更多的本地图片作为网站背景，可以将图片重命名 `background+数字` 的形式，并在 `src/components/Background.vue` 中进行修改：

```js
// 根据文件夹内的图片个数修改 Math.random() 后面的第一个数字

const bgRandom = Math.floor(Math.random() * 10 + 1)
```
