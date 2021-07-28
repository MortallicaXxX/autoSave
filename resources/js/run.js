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
								else this.container.get().th.startCopyProcess(x[0].getAttribute('alt'));
							}
						}
					})
				],
				proto : {
					imageDir : `${(window.NL_CWD).split('/')[1]}/${(window.NL_CWD).split('/')[2]}/Images`,
					partitionName : null,
					onInitialise : function(){
						const self = this;
						self.getPartitions()
						.then(function(partitions){
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
											"media" : (partitions[i][5].split("/")[1] == "media" ? true : false),
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
													else if(x[key].media == true && key)result.medias[x[key]["Sys."]] = x[key];
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
					startCopyProcess : async function(partitionName){
						this.partitionName.set(partitionName);
						console.log(this.partitionName.get());
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
					showStartNotification : function(){
						const self = this;
						console.log(self);
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
								self.e.children[0].initialise();
								next(true);
							})
						})
					},
					copyprocess : function(){
						this.rebuild()
						.then(function(){
							console.log('copyprocess');
						})
					}
				}
			})
		)
	}
}

class partitionContainer extends thorium.components{
	constructor(partition){
		super(new Div({
			prop : {class : 'partitionContainer' , alt : partition['Sys.']},
			childrens : [
				(partition.media == true ? new Text(thorium.caches.svg.usb,'center') : new Text(thorium.caches.svg.hdd,'center')),
				new Text(partition["Sys."],'center')
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
								new Text('Que voulez vous faire ?','center'),
								new Container({
									prop : {class : 'index_selecteur_container'},
									childrens : [new Text('Sauvegarder vos photos.','center')],
									proto : {
										dialogBox : null,
										onMouseDown : async function(e){
											const dialogBox = thorium.dialog.new({
												title : `Export photos - Choix support UBS d'origine`,
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
