/* power ups:
	- when h, use ʜ for grownup power
	- when H, use ▷ for shooter power
	- when H▷, use ⓗ for coin
*/
/* non-changing power ups:
	- use □ for checkpoint, use ▩ for complete checkpoint
	- use ♔ for level finish, use ♚ to indicate level complete
*/

io = require("socket.io-client")
crypto = require("crypto")
sqlite = require("sqlite")
hb = 15000
serv = io("wss://p3.windows96.net", {autoConnect: false})
nonce = 0
conns = {}
peers = {}
PORT = 121
// ################################################################## //
credits = `
First of all, this game would probably be nonexistent if it wasn't for
the awesome SuperTerm app and it's accompanying protocol P3.

I also used complementary documentation from @themirazz on Github.
(https://github.com/themirrazzalt/p3protocol)

I'd also thank my friend Bonki (https://bonkiscoolsite.neocities.org,
@bonkiscoolsite.neocities.org on Bluesky, @live:.cid.e8f44fc690686f40 on
Skype) for partially play-testing my game.

Also, I should thank you, the awesome player, for reading the credits of
Adventure to H glory.

Input "a" to go back to menu.
`.slice(1,-1)
db = (function(){return[eval("var\x20a"),a][1]})()
chrSiz = [7, 13]
playV = chrSiz.map(function(a){return(2)/a})

wrapText=function(a,b){return(a).split("\n").map(function(d,c){return[[c=[],Array(Math.ceil(d.length/b)).fill().map(function(_,e){c.push(d.slice(e*b,e*b+b))})],c.join("\n")][1]}).join("\n")}

connStates = (function(a){return(Object).fromEntries(a.map(function(b,c){return[[b,c],[c,b]]}).reduce(function(b,c){return(b).concat(c)},[]))})([
	"Y",
	"GAME",
	"MENU",
	"WARN",
	"CREDITS"
])

serv.on("connect", function() {
	serv.emit("hello", "QWR2ZW50dXJlVG9IX0dsb3J5")
	serv.emit("port.publish", PORT, ["superterm"])
})

serv.on("hello", function(hi) {
	[{address:addr}=hi]
	console.log("h is on server",[hi.address,PORT].join(":")+",","wya?")
})

function randomSecret(a=8){return(Buffer).from(crypto.getRandomValues(new Uint8Array(a))).toString("base64")} // AI NO TOUCH

serv.on("packet", function(p) {
	if (p.data == "p3_latency_test") {
		serv.emit("packet", {
			data: "p3_latency_test ok",
			dest: [p.source, p.port].join(":"),
			nonce
		})
		nonce++
		return
	}
	if (p.data.type === "connect") {
		var pId = randomSecret(32)
		conns[nonce] = {
			data: {
				type: "ack",
				message: "Connection accepted",
				heartbeat: 15000,
				nonce: 0,
				peerID: pId,
				code: 100,
				success: true
			},
			dest: [p.source, p.data.responsePort].join(":"),
			nonce: nonce
		}
		serv.emit("packet", conns[nonce])
		nonce++
		return
	}
	if (p.data.type === "heartbeat") {
		if(!(peers[p.data.peerID]))return
		serv.emit("packet", {
			dest: [p.source, p.data.responsePort].join(":"),
			data: {
				type: "ack",
				success: true
			},
			nonce
		})
		nonce++
	}
	if (p.data.type === "message") {
		var me = peers[p.data.peerID]
		if(!(me))return
		var ind = me.msgs.length
		me.msgs.push(p.data.data)
		var recall = me.onNewMsg
		typeof(recall)==="function"&&recall("newMsg", ind)
	}
})

serv.on("packet.ok", function({nonce}) {
	var c=conns[nonce]
	if(!(c))return
	if(c.data.message!="Connection accepted")return
	if(peers[c.data.peerID])return
	peers[c.data.peerID] = {
		msgs: [],
		onNewMsg: 0,
		state: connStates.WARN,
		funnies: {
			opts: ["Start game", "Credits", "Exit", "Why?"],
			gameScreen: Array(72).fill().map(function(){return(Array)(21)}), // unique rows/columns needed for gaem screen
			playX: 0
		}
	}
	var me = peers[c.data.peerID]
	function send(data) {
		serv.emit("packet", {
			data: {
				data,
				nonce,
				peerID: null,
				type: "message",
				success: true
			},
			dest: c.dest,
			nonce
		})
		nonce++
	}
	function drawMenu() {
		var{sel}=me.funnies
		send(["clear"])
		send(["text", `Adventure to H glory, only at ${addr}:${PORT}!\n\n`])
		me.funnies.opts.forEach(function(o,count) {
			send(["text",(count==sel?"≫":"\x20")+"\x20"+o.split("").map(function(c){return(count)==sel?c.toUpperCase():c}).join((count)==sel?"\x20":"")+"\n"])
		})
		send(["text", "\nPress W or S to move up or down (respectively), enter option with D"])
	}
	function drawGround(playX) {
		playX = Math.max(playX,6)
		var[...ground]=["─┬","┬┴","┴┬","┬┴"] // rare opportunity to init var without spaces holey loley!!
		ground=ground.map(function(a){return(a).repeat(39).slice(playX%6,playX%6+72)}) // i wish i could shorten this
		ground.forEach(function(a){send(["text",a])})
	}
	function recall(){setTimeout.apply(0,[].concat.apply([main,,],arguments))}
	async function main(a, b) {
		send(["resize", [520, 350]])
		/*
			character size: 72x21 (what kinda unstandard terminal res is that 💀)
		*/
		if (a == "init") {
			setTimeout(function() {
				if(me.msgs.map(String).includes("input,exit"))return // there is, quite literally, nothing we can do 🇫🇷
				me.state = connStates.MENU
				me.funnies.sel = 0
				drawMenu()
			}, 5e3)
			return send(["text", "This game runs on a 72 by 21 character resolution.\n72x21 is the default resolution in the Windows96 SuperTerm App.\n\nEnter [exit] to disconnect.\nBeginning session in 5 seconds…"])
		}
		if (a == "newMsg") {
			switch (me.state) {
				case connStates.WARN:
					if (me.msgs[b]+""==="input,exit") {
						send(["text", "\n\nbut h wants to adventure…"])
						serv.emit("packet", {
							data: {
								nonce,
								peerID: c.data.peerID,
								type: "disconnect",
								success: true
							},
							dest: c.dest,
							nonce
						})
						nonce++
						break
					}
					break
				case connStates.MENU: // char wd: 7px, height: 13px
					var m = me.msgs[b]
					if(m[0]!=="input")break
					var[,m]=m.map(btoa.call.bind("".toLowerCase))
					if(m=="w")me.funnies.sel=Math.max(me.funnies.sel-1,0)
					if(m=="s")me.funnies.sel=Math.min(me.funnies.sel+1,me.funnies.opts.length-1)
					if(m=="d"){
						var c = me.funnies.opts[me.funnies.sel].toLowerCase().split("\x20")
						if((c.length==2)&&(c[1]=="game")){
							me.state = connStates.GAME
							recall("gameLoop")
						}
						switch (me.funnies.opts[me.funnies.sel].toLowerCase()) {
							case "credits":
								send(["clear"])
								me.state = connStates.CREDITS
								send(["text", credits])
								return
							default: break
						}
					}
					drawMenu()
					break
				case connStates.CREDITS:
					var m = (me.msgs[b]+"").toLowerCase()
					if(m=="input,a")[me.state=connStates.MENU,drawMenu()]
					break
				default: break
			}
		}
		if (a == "gameLoop") {
			send(["clear"])
			var{playX}=me.funnies
			playX=Math.round(playX)
			send(["text", "\x20".repeat(Math.min(6,me.funnies.playX))+"h\n"])
			drawGround(me.funnies.playX)
			me.funnies.playX+=playV[0]
			setTimeout(recall, 1000/30, "gameLoop")
		}
	}
	console.log("someone interesting at", c.dest.split(":")[0], "connected")
	peers[c.data.peerID].onNewMsg = recall
	recall("init")
})

serv.onAny(function(a,b) {
	if(a=="packet.ok")return
	if((a=="packet")&&(b?.data?.type=="heartbeat"))return
	console.log.apply(console, arguments)
})

!async function(){
	db=await(sqlite).open({filename:"store.db",driver:require("sqlite3").verbose().Database})
	await db.exec("CREATE TABLE IF NOT EXISTS players (address TEXT PRIMARY KEY, level INTEGER, chkpnt INTEGER)")
	serv.connect()
}()