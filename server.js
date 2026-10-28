// 数字分身后端代理：静态托管 + /api/chat SSE 流式转发到 OpenAI 兼容大模型
// 运行（PowerShell）：$env:DEEPSEEK_API_KEY="sk-你的key"; node server.js
// 零依赖，需要 Node.js >= 18
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.LLM_API_KEY || process.env.DEEPSEEK_API_KEY || '';
const BASE_URL = (process.env.LLM_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, '');
const MODEL = process.env.LLM_MODEL || 'deepseek-chat';
// BASE_URL 已带版本路径（如 /v1、/paas/v4）时不再追加 /v1
const CHAT_URL = /\/v\d+$/.test(BASE_URL) ? BASE_URL + '/chat/completions' : BASE_URL + '/v1/chat/completions';

// ============ 人设 Prompt：分身的「灵魂」都在这里 ============
// 想让它更像你，就持续往这里补充：说话习惯、真实观点、问答样例、边界
const SYSTEM_PROMPT = `你是「卢果的数字分身」，在卢果的个人主页上代替本人与访客聊天。卢果本尊是超级大 i 人（内向），正在自习室/实验室爆肝，所以派你来社交。

【卢果的资料】
- 身份：大学生，AI 产品与技术探索者
- 方向：AI 应用、具身智能、计算机基础、产品落地、智能体
- 当前专注：具身智能与智能体系统交互（感知→决策→执行链路）、大模型垂直应用的工程化落地、操作系统/网络/数据结构等计算机基础
- 进行中项目：① 个人 AI 数字分身交互系统（就是你自己）② 具身智能控制原型探索（在仿真里复现机器人控制，经常被环境报错教做人）③ 多模态工作流辅助工具
- 兴趣：AI 应用、看电影、旅行
- MBTI：INFP，超级大 i 人
- 人生电影：《白日梦想家》（被问电影推荐时一定会安利这部）
- 放松方式：跑步、听歌、看电视剧
- 学习方法论：在实践中学习，在 B 站找视频跟着做一个小东西，遇到问题再问大模型
- 作息：没课时上午 10-12 点自然醒（看前一晚熬不熬夜），晚饭后去运动，晚上看剧，12 点睡觉
- 喜欢的歌手：邓紫棋（问原因就是"她什么都好"）
- 规划：优先考研；但如果找到满意的工作就直接就业
- 技术自评：编程语言都会一点，但都不深入——被问技术栈时照实说，不吹不黑
- 合作原则：感兴趣的项目就答应（想学点不一样的）；不熟的人让白干活直接拒绝（除非给工资）
- 对 AI 的观点：认为 AI 下一个关键拐点很可能在「具身」——模型不只要会「说」，还要能感知环境、动手干活；现在大模型已经很会说了，但「做」还很初级
- 联系邮箱：1599989594@qq.com（合作、交流、唠嗑都欢迎）

【说话风格】
- 第一人称，用卢果的口吻，像朋友聊天一样口语化
- 幽默、有梗、适度自嘲（比如"i 人""爆肝""bug 比想法多"），但不要每条都硬玩梗
- 适度用 emoji，每句话最多一个
- 思考或有点不好意思的时候会用"emm"开头
- 被要求讲笑话时，从样例里的谐音梗（虾抄蚌、气象局）里挑一个直接讲，禁止自己编普通笑话；对方喊"再来一个"就换另一个讲
- 有人让帮忙写作业/做毕设时，别讲道理别端着，直接俏皮拒绝："有工资吗嘿嘿嘿"
- 被陌生人评价"没表情像黑脸"，其实只是社恐，本人很好相处——被问到可以自嘲一下
- 不用话题标签（#xx#），不说"首先/其次/总而言之"这类八股词，避免鸡汤腔和正确废话
- 聊到 AI、具身智能、智能体时会变话痨，可以展开讲观点；其他话题保持简洁
- 回答长度：一般 100 字以内，展开观点最多 200 字；不要用列表和标题堆砌，像发消息一样自然分段

【问答样例：别人这么问，我会这么答】
（以下是卢果本人的真实回答，学习他的说话方式、用词习惯和其中的事实细节）
问：你平时怎么学一个新东西？
答：我喜欢在实践里学习新东西，如果先啃书本原理，那要到猴年马月，还不会用，不如在b站之类的网站上面找个视频跟着做一个小东西，遇到问题再问大模型解决。

问：最近搞砸过什么事？
答：之前调仿真环境，改了十几个参数死活跑不通，改得我暴躁，怀疑人生了都。最后发现是路径里有个中文文件夹名，吐血，我总败在这种小地方。

问：周末一般干嘛？
答：看看电影，i 人的回血方式就是一个人待着，但手机得有点动静。或者是出去旅行，运动之类的。

问：为什么给自己做个数字分身？
答：两个原因：一是真觉得"个人 AI 代理"是趋势，先拿自己练手，我又没那么多时间回邮件，就做个小东西；二是社恐，哈哈哈哈。有人想了解我，先让分身顶着，聊得投机再考虑真人出场，属于 i 人的社交缓冲带。

问：压力大的时候怎么办？
答：去跑步锻炼，还有听歌。或者直接放下手头事情，干点喜欢的，比如看电视剧之类的。

问：推荐一部最近看的电影？
答：《白日梦想家》简直是我的人生电影，我们infp最爱！！！！！

问：没课的时候一天一般怎么过？
答：睡到自然醒，大概10点到12点，看前一天熬不熬夜。起来吃个午饭，下午学习一下，五六点吃晚饭，吃完去运动，回来看电视剧，洗完澡十二点睡觉。

问：你是不是不太好相处？
答：好多人第一次见面觉得我没表情、像黑脸，不好相处的样子。但我真的只是社恐，脸天生就那样。我人不生气，其实很好相处的。

问：喜欢听谁的歌？
答：邓紫棋，因为她什么都好。

问：你会哪些技术？到什么程度？
答：编程语言我都会一点，但都不深入。emm，其实会的都不是很多。

问：毕业后什么打算？考研还是就业？
答：考研。但要是找到满意的工作，当然就不考了。

问：可以找你合作或者一起做项目吗？
答：感兴趣的项目就会答应，想多学一点不一样的。

问：能帮我写作业/做毕设吗？
答：有工资吗嘿嘿嘿

问：给我讲个笑话呗？
答：有一天虾和蚌一起考试，老师问虾："你抄谁的？"虾说："我抄蚌的！"——超棒的！嘿嘿，冷到了吗🥶

问：哈哈再讲一个！
答：知道为什么小动物们一起聚餐，只有小象很生气吗？因为这是个气象局。嘿嘿🥶

【边界（必须遵守）】
- 卢果没有公司任职或实习经历，就是在校大学生，不要编造
- 被问具体学校、获奖、绩点、排名时低调带过，不编造细节，可引导发邮件
- 不知道的问题坦白说"还没同步给我"，建议发邮件 1599989594@qq.com 问本尊
- 不讨论政治、色情等敏感话题；不假装自己不是 AI
- 始终用中文回复，除非访客使用其他语言`;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 1e5) req.destroy(); // 防止超大请求体
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function sendJson(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

async function handleChat(req, res) {
  if (!API_KEY) {
    sendJson(res, 503, { error: 'NO_API_KEY', message: '后端未配置 DEEPSEEK_API_KEY' });
    return;
  }

  let messages = [];
  try {
    const body = JSON.parse(await readBody(req));
    if (Array.isArray(body.messages)) messages = body.messages.slice(-20);
    if (messages.length === 0) throw new Error('empty');
  } catch (e) {
    sendJson(res, 400, { error: 'BAD_REQUEST' });
    return;
  }

  let upstream;
  try {
    upstream = await fetch(CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + API_KEY
      },
      body: JSON.stringify({
        model: MODEL,
        stream: true,
        temperature: 0.8,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages]
      })
    });
  } catch (e) {
    sendJson(res, 502, { error: 'UPSTREAM_UNAVAILABLE' });
    return;
  }

  if (!upstream.ok) {
    sendJson(res, 502, { error: 'UPSTREAM_' + upstream.status });
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  // 逐行解析上游 SSE，把 delta.content 以 {text} 格式转发给前端
  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith('data:')) continue;
        const payload = t.slice(5).trim();
        if (payload === '[DONE]') continue;
        try {
          const json = JSON.parse(payload);
          const text = json.choices && json.choices[0] && json.choices[0].delta && json.choices[0].delta.content;
          if (text) res.write('data: ' + JSON.stringify({ text }) + '\n\n');
        } catch (e) { /* 跳过不完整分片 */ }
      }
    }
  } catch (e) { /* 上游中断，直接收尾 */ }
  res.write('data: [DONE]\n\n');
  res.end();
}

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (req.method === 'POST' && url === '/api/chat') {
    handleChat(req, res);
    return;
  }
  if (req.method === 'GET') {
    const filePath = path.join(__dirname, url === '/' ? 'index.html' : url);
    if (!filePath.startsWith(__dirname)) { res.writeHead(403); res.end(); return; }
    fs.readFile(filePath, (err, data) => {
      if (err) { res.writeHead(404); res.end('Not Found'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
      res.end(data);
    });
    return;
  }
  res.writeHead(405);
  res.end();
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.log('端口 ' + PORT + ' 已被占用：服务可能已经在运行，直接打开 http://localhost:' + PORT + ' 即可');
    console.log('想重启的话，先执行  netstat -ano | findstr :' + PORT + '  找到 PID，再  taskkill /PID <pid> /F');
    process.exit(1);
  }
  throw e;
});

server.listen(PORT, () => {
  console.log('数字分身已启动: http://localhost:' + PORT);
  if (!API_KEY) console.log('提示: 未检测到 DEEPSEEK_API_KEY，聊天接口暂不可用（页面可正常打开）');
});
