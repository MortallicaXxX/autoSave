class ExportImage extends thorium.components{
	constructor(){
		super(
			new Container({
				prop : {id : 'ExportImage'},
				childrens : [
					new Div({
						prop : {id : 'deviceContainer'},
					}),
					new Div({
						prop : {class : 'btn'},
						childrens : [new Text('Valider','center')],
						proto : {
							container : null,
							onInitialise : function(){
								this.container.set(this.e.parentNode);
							},
							onMouseDown : async function(){
								let x = this.container.get().querySelectorAll('.partitionContainer.active');
								if(x.length == 0)this.container.get().showError();
								else this.container.get().th.startCopyProcess(x[0].getAttribute('mounton'));
							}
						}
					})
				],
				proto : {
					imageDir : `/${(window.NL_CWD).split('/')[1]}/${(window.NL_CWD).split('/')[2]}/Images`,
					partitionPath : null,
					partitionName : null,
					textInformation : null,
					onInitialise : function(){
						console.log(this.imageDir.get());
						const self = this;
						self.getPartitions()
						.then(function(partitions){
							console.log(partitions);
							for(const mediaKey of Object.keys(partitions.medias)){
								new UI([new partitionContainer(partitions.medias[mediaKey])]).buildIn(self.e.children[0])
							}
						})
					},
					getPartitions : function(){ // fonction qui retourne les partitions du pc // compatible linux uniquement

						function exec(){ // fonction d'execution de la commande 'df -h' et filtrage de la réponse.
							return new Promise(function(next){
								Neutralino.os.execCommand({command:'df -h'})
								.then(function(result){
									next(Array.from({length : result.output.split('\n').length} , (x,i) => result.output.split('\n')[i].split(' ').filter((a) => a)));
								})
							})
						}

						return new Promise(function(next){ // fonction de normalisation du résultat du filtrage
							exec()
							.then(function(partitions){
								const p = {}
								for(const i of Array.from({length : partitions.length} , (x,i) => i)){
									if(partitions[i].length == 6){
										p[partitions[i][0]] = {
											"Sys." : partitions[i][0],
											"Taille" : partitions[i][1],
											"Utilisé" : partitions[i][2],
											"Dispo" : partitions[i][3],
											"Uti%" : partitions[i][4],
											"MontOn" : partitions[i][5],
											"media" : (partitions[i][5].split("/")[1] == "media" ? partitions[i][5].split("/")[partitions[i][5].split("/").length - 1] : false),
											"snap" : (partitions[i][5].split("/")[1] == "snap" ? true : false),
										}
									}
									if(i == partitions.length - 1)next((function(x){
										return new Promise(async function(final){
											const result = {snaps : {} , drives : {} , medias : {}}
											for(const i of Array.from({length : x.length} , (x,i) => i)){
												let key = Object.keys(x)[i];
												try{
													if(typeof key == 'undefined')throw false;
													if(x[key].snap == true && key)result.snaps[x[key]["Sys."]] = x[key];
													else if(x[key].media != false && key)result.medias[x[key]["Sys."]] = x[key];
													else result.drives[x[key]["Sys."]] = x[key];
												}catch(err){}

												if(i == x.length -1)final(result);
											}
										})
									})(p));
								}
							})
						})

					},
					startCopyProcess : async function(partitionPath){
						this.partitionPath.set(partitionPath); // sauvegarde du path du média
						this.partitionName.set(partitionPath.split('/')[partitionPath.split('/').length - 1]); // sauvegarde du nom du média
						this.showStartNotification();
						this.copyprocess();
					},
					showError : function(){
						Neutralino.os.showMessageBox({
							title : "Erreur",
							content: `Il s'emblerait que vous n'ayez pas sélectionner un support d'origine.`,
							type : "ERROR"
						});
					},
					showStartNotification : function(){ // affichage notification lancement de la copy
						const self = this;
						Neutralino.os.showNotification({
							summary: 'Lancement export.',
							body: `L'export des photos du média ${self.partitionName.get()} vers ${self.imageDir.get()} débute maintenant.`,
						});
					},
					rebuild : function(){
						const self = this;
						return new Promise(function(next){
							self.e.innerHTML = '';
							new UI([new loadingExportImages()])
							.buildIn(self.e)
							.then(function(){
								self.textInformation.set(self.e.querySelectorAll('div#info')[0]);
								next(true);
							})
						})
					},
					printTextInformation : function(text){ // fonction qui modifie le texte informatif l'ors de la copie
						const self = this;
						setTimeout(function(){
							self.textInformation.get().innerHTML = `... ${text} ...`;
						},500);
					},
					copyprocess : async function(){ // lancement du processus de copie du média

						const dateCopy = Date.now();

						const self = this;

						function copyFile(originPath,targetPath){
							return new Promise(function(copy){
								Neutralino.os.execCommand({
								    command : `cp ${originPath} ${targetPath}`
								})
								.then(function(result){
									console.log(result);
									console.log(`cp ${originPath} ${targetPath}`);
									copy(self.printTextInformation(`copie de ${targetPath}`));
								})
							})
						}

						function createDirectory(fullPath){
							return new Promise(async function(create){
								create(await Neutralino.filesystem.createDirectory({
								  path: fullPath,
								}));
							})
						}

						function readDirectory(path){
							return Neutralino.filesystem.readDirectory({
							  path: path
							})
						}

						async function proceduralCopy(path){ // lancement de la procédure de copy procédurale

							const fromRootFolder = await (function(){ // extraction du chemin parcourus pour restituer une hierarchie similaire
								var isRoot = false;
								return (path.split('/').filter(function(x,i){
									if(isRoot == true)return `"${x}"`
									if(x == self.partitionName.get())isRoot = true;
								}).join('/'));
							})();

							console.log(`fromRootFolder : ${fromRootFolder}`);

							return new Promise(function(next){
								readDirectory(path)
								.then(async function(result){


									const entries = result.entries.filter(function(x,i){
										if(x.entry[0] != '.' && x.entry[0] != '$')return `${x}`;
									});

									if(entries.length == 0)next(true);

									for(const i of Array.from({length : entries.length} , (x,i) => i)){
										if(entries[i].type == "DIRECTORY"){
											await new Promise(async function(create){
												createDirectory(`/${self.imageDir.get()}/${dateCopy}${(fromRootFolder != '' ? `/${fromRootFolder}/${entries[i].entry}` : `/${entries[i].entry}`)}`)
												.then(async function(){
													create(await proceduralCopy(`${path}/${entries[i].entry}`))
												})
											})
										}
										if(entries[i].type == "FILE" && (entries[i].entry.split('.')[entries[i].entry.split('.').length - 1]/*.toLowerCase()*/ == 'jpeg' || entries[i].entry.split('.')[entries[i].entry.split('.').length - 1]/*.toLowerCase()*/ == 'jpg')){
											await copyFile(`${path}/${entries[i].entry}`,`${self.imageDir.get()}/${dateCopy}/${(fromRootFolder != '' ? `${fromRootFolder}/${entries[i].entry}` : `${entries[i].entry}`)}`)
										}
										if(i == entries.length - 1)next(true);
									}

								})
							})
						}

						await createDirectory(`/${self.imageDir.get()}/${dateCopy}`)
						return new Promise(function(next){
							self.rebuild()
							.then(function(){
								proceduralCopy(self.partitionPath.get())
								.then(function(result){
									next(true);
								})
							})
						})
					}
				}
			})
		)
	}
}

class partitionContainer extends thorium.components{
	constructor(partition){
		console.log(partition);
		super(new Div({
			prop : {
				class : 'partitionContainer' ,
				Sys : partition['Sys.'],
				MountOn : partition['MontOn']
			},
			childrens : [
				(partition.media != false ? new Text(thorium.caches.svg.usb,'center') : new Text(thorium.caches.svg.hdd,'center')),
				(partition.media != false ? new Text(partition["media"],'center') : new Text(partition["MontOn"],'center'))
			],
			proto : {
				onMouseDown : function(){
					this.e.radioLike();
				}
			}
		}))
	}
}

class loadingExportImages extends thorium.components{
	constructor(){
		super(new Div({
			prop : {id : 'exportLoader'},
			childrens : [
				new Div({prop : {id : 'arrow',text:thorium.caches.svg.arrow}}),
				new Div({prop : {id : 'hdd',text:thorium.caches.svg.hdd}}),
				new Div({prop : {id : 'info',text:'... Export en cours...'}})
			]
		}));
	}
}

thorium.conf = {
	id : 'app',
	parent : document.body
}

thorium.onReady = function(self){
	self.GUI([
		new Ccontainer({
			type :'app',
			prop : {id : 'app'},
			childrens : [
				new Container({
					prop : {id : 'app_container'},
					childrens : [
						new Container({
							prop : {id : 'index_selecteur'},
							childrens : [
								new Div({
									prop : {id:'acceuil_header'},
									childrens : [
										new Text('Que voulez vous faire ?','center')
									],
									proto : {
										onInitialise : function(){
											new UI([new Div({
												prop : {text : `bonjour ${window.NL_CWD.split('/')[2]}`}
											})])
											.buildIn(this.e)
										}
									}
								}),
								new Container({
									prop : {class : 'index_selecteur_container'},
									childrens : [new Text('Sauvegarder vos photos.','center')],
									proto : {
										dialogBox : null,
										onMouseDown : async function(e){
											const dialogBox = thorium.dialog.new({
												title : `Export photos - Choix support USB d'origine`,
												// background : "#00012f",
												modal : true,
											});
											this.dialogBox.set(dialogBox);

											new UI([new ExportImage()])
											.buildIn(dialogBox.body)
											.then(function(){
												(new THORUS()).parse(dialogBox.g)
												.then(function(){
													dialogBox.body.initialise();
												})
											})
										}
									}
								}),
								new Container({
									prop : {class : 'index_selecteur_container'},
									childrens : [new Text('Effectuer un back-up.','center')]
								})
							]
						})
					]
				})
			]
		})
	])
	.buildIn(document.body)
	.then(function(){
		self.initialise();
	})
}

addCss('style',[`
	:root{
		--bck-color-default : #00012f;
		--bck-color-btn1 : rgba(255,255,255,0.2);
		--bck-color-btn2 : rgba(255,255,255,0.5);
		user-select: none;
	}

	#app {
    position: absolute;
    height: 100%;
    width: 100%;
    background-color: var(--bck-color-default);
    left: 0;
    top: 0;
    display: grid;
    color: ;
    background-image: linear-gradient(rgba(255, 255, 255, 0.1) , transparent);
    font-family: Inconsolata, Monaco, Consolas, 'Courier New', Courier;
	}

	#app_container {
    display: grid;
	}

	#index_selecteur {
    height: 80%;
    width: 80%;
    margin: auto;
    color: white;
    display: grid;
	}


	#acceuil_header {
	  display: grid;
	  height: fit-content;
	}

	div#acceuil_header > div {
		text-align: center;
		height: fit-content;
		font-size: 7vw;
		animation : headerTitle 2s;
		margin-bottom: 2vw;
	}

	div#acceuil_header > p {
    grid-row: 2;
		animation : headerText 4s 1;
	}

	.index_selecteur_container {
    margin: auto;
    width: 80%;
    display: grid;
    height: 40%;
    background-color: var(--bck-color-btn2);
    border-radius: 5vw;
		color : white;
	}

	.index_selecteur_container:hover {
		background-color: lightgreen;
		color : black;
	}

	@keyframes headerTitle{
		0% {
			transform : translateX(-200%);
		}
		100% {
			transform : translateX(0%);
		}
	}

	@keyframes headerText{
		0% {
			opacity : 0;
		}
		50% {
			opacity : 0;
		}
		100% {
			opacity : 1;
		}
	}
`])

addCss('style-ExportImage',[`
	container#ExportImage {
		display: grid;
    height: 100%;
    width: 100%;
    background: var(--bck-color-default);
		grid-template-rows: minmax(0,1fr) 5vw;
	}

	.partitionContainer {
    display: grid;
    height: 5vw;
    width: 90%;
    grid-template-rows: minmax(0,1fr);
    grid-template-columns: minmax(0,1fr) minmax(0,1fr);
    background-color: var(--bck-color-btn1);
    margin: 1vw auto;
    border-radius: 0.5vw;
		color : white;
	}

	.partitionContainer:hover {
		background-color: var(--bck-color-btn2);
	}

	.partitionContainer.active {
		background-color: lightgreen;
		color : black;
	}

	.partitionContainer svg {
	   height: 3vw;
	}

	.btn {
    height: 3vw;
    color: white;
    grid-row: 2;
    width: 15vw;
    margin: auto;
    border-radius: 0.5vw;
    background-color: var(--bck-color-btn1);
		display : grid;
	}

	.btn:hover {
		background-color: var(--bck-color-btn2);
	}

	div#exportLoader {
    display: grid;
    height: 100%;
    width: 100%;
    grid-row: 1/3;
    grid-template-rows: minmax(0,1fr) 5vw;
    color: white;
	}

	div#exportLoader > div#arrow {
	    height: 80%;
	    width: 80%;
	    display: grid;
	    margin: auto;
	    grid-row: 1;
	    grid-column: 1;
	}

	div#exportLoader > div#arrow > svg {
    height: 50%;
    width: 50%;
    margin: auto;
    fill: lightgreen;
		animation : export 1s infinite;
	}

	div#exportLoader > div#hdd {
	    height: 20%;
	    width: 20%;
	    display: grid;
	    grid-template-rows: minmax(0,1fr);
	    grid-template-columns: minmax(0,1fr);
	    grid-row: 1;
	    grid-column: 1;
	    margin: auto;
	    margin-bottom: 0;
	}

	div#exportLoader > div#hdd > svg {
    height: 100%;
    width: 100%;
    margin: auto;
	}

	div#exportLoader > div#info {
    text-align: center;
    height: 2vw;
    margin: auto;
	}

	@keyframes export{
		25% {transform : translateY(-40%)}
		75% {transform : translateY(40%)}
	}
`])
