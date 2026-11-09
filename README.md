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

采用 `HarmonyOS Sans` 开源字体，采用字体拆分，提升加载速度（用的哔哩哔哩加速CDN！）

```js
https://s1.hdslb.com/bfs/static/jinkela/long/font/regular.css
```

#### 4、动漫背景

```js
https://api.imlazy.ink/img
```

#### 5、自动更新

> 当前构建版本号（由 vite.config.js 通过 define 注入）轮询 每 30s 检查一次
>
> 带时间戳刷新，绕过浏览器与 CDN 缓存检测页面更新

#### 6、花瓣漂浮

> 花瓣漂浮特效：纯装饰层，不拦截鼠标事件

#### 7、生日特别版 - 模式：农历 + 新历

> 生日当天0点开启蛋糕、生日歌、祝福文案，并且生日当天一直显示
>
> 生日当天23点30分开始显示结束寄语
