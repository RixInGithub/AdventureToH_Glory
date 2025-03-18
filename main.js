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
bcrypt = require("bcryptjs")
hb = 15000
serv=io("wss://p3.windows96.net",{autoConnect:false,rejectUnauthorized:!1})
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
Skype) for playtesting my game.

Also, I should thank you, the awesome player, for reading the credits of
Adventure to H glory.

Input "a" to go back to menu.
`.slice(1,-1)
db = require("better-sqlite3")("store.db")
chrSiz = [7, 13]
playV=[8/7,1.45]
gravity=-4/13
msgs = {}

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
		var pId = Object.keys(peers)[0]||randomSecret(32)
		while(Object.keys(peers).includes(pId))pId=randomSecret(32)
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
			nonce
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
	if (p.data.type === "disconnect") {
		var[me]=[]
		void((me=peers[p.data.peerID])&&(me.disconnected=1))
	}
})

serv.on("packet.err", function({nonce:n},p) {
	var{dest}=msgs[n]
	void((p=peers[Object.values(conns).find(function(v){return(v).dest===dest}).data.peerID])&&(p.disconnected=1))
})

function someUtilIdek(a) {
	return(Array)(Math.ceil(a/playV[0])).fill().reduce(function(b){return(b)+playV[0]},0) // more accuracy
}

function equalOnNDecimals(a,b,n){return(Math).floor(a*(n**10))===Math.floor(b*(n**10))}

serv.on("packet.ok", function({nonce:n}) {
	var c=conns[n]
	if(!(c))return
	if(c.data.message!="Connection accepted")return
	if(peers[c.data.peerID])return
	peers[c.data.peerID] = {
		msgs: [],
		onNewMsg: 0,
		state: connStates.WARN,
		funnies: {
			opts: ["Start game", "Credits", "Exit", "Why?"],
			gameScreen: Array(21).fill().map(function(){return"\x20".repeat(72).split("")}), // unique rows/columns needed for gaem screen
			playX: someUtilIdek(6),
			playY: 0,
			playYVel: 0,
			infJump: !1
		}
	}
	var me = peers[c.data.peerID]
	me.funnies.reachX=me.funnies.playX
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
	function disconnect(guiltTrip) {
		if(guiltTrip)send(["text", "\n\nbut h wants to adventure…"])
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
	function clearGame() {
		me.funnies.gameScreen.forEach(function(a,b){me.funnies.gameScreen[b]="\x20".repeat(a.length).split("")})
	}
	function drawGround(playX) {
		playX = Math.max(playX,6)
		var[...ground]=["┬┴","┴┬","┬┴","─┬"] // rare opportunity to init var without spaces holey loley!!
		ground=ground.map(function(a){return(a).repeat(4).slice(playX%6).slice(0,2).repeat(36)})
		ground.forEach(function(a,b){me.funnies.gameScreen[20-b]=a.split("")})
	}
	function drawPlay(playX,playY) {
		var ground = true
		var[...res]=[Math.min(6,playX),16-Math.round(playY)]
		// console.log(res)
		var[arrX,ind]=res
		if(ind<0)[ind=me.funnies.gameScreen.length-1+(ind%me.funnies.gameScreen.length),ground=false]
		var[...arr]=me.funnies.gameScreen[ind]
		arr[arrX]="h"
		me.funnies.gameScreen[ind]=arr
		return(res).concat([ground])
	}
	function drawGame() {
		(me.funnies.oldScreen!=me.funnies.gameScreen+"")&&[send(["clear"]),me.funnies.oldScreen=me.funnies.gameScreen+"",send(["text",[{color:"#eeedf0",background:"#012456",text:me.funnies.gameScreen.map(function(a){return(a).join("")}).join("\n")}]])]
	}
	function recall(){me.disconnected||setTimeout.apply(0,[].concat.apply([main,,],arguments))}
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
						disconnect(true)
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
							case "exit":
								disconnect(true)
							default: break
						}
					}
					drawMenu()
					if(bcrypt.compareSync(m,"$2b$10$Ox4msxvSAWTyaUM/lEL3WOAE7uu5AdHM5CVVwE5LZzk286fxo891u"))[me.funnies.infJump=!(me.funnies.infJump),send(["text","\n\nwtf,r,u,trying,2,do".split(",").join("\x20")])] // noone is gonna guess la secret codeword for this feature
					break
				case connStates.CREDITS:
					var m = (me.msgs[b]+"").toLowerCase()
					if(m=="input,a")[me.state=connStates.MENU,drawMenu()]
					break
				case connStates.GAME:
					var m = me.msgs[b]
					if(m[0]!="input")return
					var[a,jumpd]=[m[1].toLowerCase().split(""),(!!(me.funnies.playYVel))&&(!(me.funnies.infJump))]
					// if(me.funnies.reachX!=me.funnies.playX)return
					a.forEach(function(c) {
						if((/**/c=="w")&&(!(jumpd)))[me.funnies.playYVel+=playV[1],jumpd=!(me.funnies.infJump)]
						if(/***/c=="a")me.funnies.reachX=Math.max(me.funnies.reachX-someUtilIdek(6),0)
						// ........ s
						if(/***/c=="d")me.funnies.reachX+=someUtilIdek(4)
					})
				default: break
			}
		}
		if (a == "gameLoop") {
			var{playX,playY,playYVel}=me.funnies
			var[moved]=[!1]
			// playX=Math.round(playX)
			clearGame()
			var[play]=[drawPlay(Math.round(playX),playY)]
			if(play[2])drawGround(playX)
			drawGame()
			// console.log(playX, me.funnies.reachX, playX==me.funnies.reachX)
			var[prevX]=[me.funnies.playX]
			if(equalOnNDecimals(me.funnies.playX,me.funnies.reachX,5))me.funnies.reachX=me.funnies.playX
			if(me.funnies.reachX<me.funnies.playX)[me.funnies.playX=Math.max(me.funnies.playX-playV[0],0),moved=!0,((me.funnies.playX==0)&&(me.funnies.reachX=0))]
			if((!(moved))&&(me.funnies.reachX>me.funnies.playX))me.funnies.playX+=playV[0]
			var[prevY]=[playY]
			me.funnies.playY=Math.max(me.funnies.playY+me.funnies.playYVel,0)
			void((me.funnies.playY!=prevY)?(me.funnies.playYVel+=gravity):(me.funnies.playYVel=0))
			setTimeout(recall,1000/30,"gameLoop")
		}
	}
	console.log("someone interesting at", c.dest.split(":")[0], "connected")
	peers[c.data.peerID].onNewMsg = recall
	recall("init")
})

serv.on("disconnect",serv.connect.bind(serv))

serv.onAny(function(a,b) {
	if(a=="packet.ok")return
	if((a=="packet")&&(b?.data?.type=="heartbeat"))return
	console.log.apply(console, arguments)
})

!function(oEmit){[oEmit=serv.emit,serv.emit=function(a,b,...c){return[a=="packet"&&(msgs[b.nonce]=b),oEmit.apply(serv,[a,b].concat(c))][1]},db.exec("CREATE\x20TABLE\x20IF\x20NOT\x20EXISTS\x20players\x20(address\x20TEXT\x20PRIMARY\x20KEY,\x20level\x20INTEGER,\x20chkpnt\x20INTEGER)"),serv.connect()]}()