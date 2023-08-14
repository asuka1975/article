# はじめに

　本記事は、ブログのテストを兼ねた[Qiitaからのコピー](https://qiita.com/asuka1975/items/5384ff4c20accb87cdca)です。

　本記事では、Dockerコンテナ上でグラフィックスプログラミングを行える環境の構築を説明していきます。といってもグラフィックスプログラミングにおいて、依存するライブラリは非常に少ないですしセットアップが面倒なものでは無いので、わざわざDocker上でやるようなものではないですが、ロマンということで。需要はなさそうですが書いていきます。
今回の記事で使うファイルはすべて[ここ](https://github.com/asuka1975/gl-docker)に置きました。

# 対象読者

- あらゆるプログラミングを仮想化された環境で行いたい方
- OpenGLを使うようなシミュレーション系の研究で実験環境の移行や引き継ぎを楽にしたい方

# 想定環境

- Linux
- Docker導入済み
- NVIDIAグラフィックスドライバー導入済み

# 手順

1. Dockerfile
2. Docker上のX11アプリをホストで表示させられるようにする
3. NVIDIA container toolkit の導入
4. DockerでのGPU利用

## Dockerfile

```dockerfile
FROM python:3.10-slim-buster

ARG UID
ARG GID
ARG USERNAME
ARG GROUPNAME

RUN apt update && apt upgrade -y
RUN apt install libglfw3-dev python3-pip -y

RUN mkdir -p /opt/app

COPY main.py /opt/app

RUN groupadd -g $GID $GROUPNAME
RUN useradd -m -u $UID -g $GID $USERNAME

RUN chown $USERNAME:$GROUPNAME -R /opt/app
USER $USERNAME

RUN pip install glfw PyOpenGL numpy

WORKDIR /opt/app
ENTRYPOINT ["/bin/bash"]
```

以上のDockerfileで記述されたコンテナを使って、OpenGLの動作確認を行います。

## Docker上のX11アプリをホストで表示させられるようにする

　通常LinuxのGUIはX window systemにより実現されます。X window systemはXサーバとXクライアントからなるウィンドウシステムで**ソケット通信を通じてUIの描画**を行います。Xクライアントが何を描画したいかを決め、Xサーバに描画を依頼することでGUIが実現できるわけです。今回の場合Dockerコンテナ上でXクライアントが動作し、ホストのXサーバが画面の表示やマウス・キーボード入力などを受け付ける形と成ります。
　XサーバとXクライアントのやり取りはソケット通信を通じて行われることを述べましたが、同じコンピュータ内にXサーバとXクライアントが並立している場合には、ソケットファイルが使われます。このやり取りに使われるソケットファイルは/tmp/.unix-X11内に存在しています。つまり、**この/tmp/.unix-X11をコンテナ上にマウント**してやれば、コンテナ上のXアプリをホストに表示できるようになるはずです。ただこれだけでは、ウィンドウを表示することができません。なぜならXクライアントが接続するXサーバがされていないのに加え、**Xクライアントを動かしているユーザーがXサーバに認証されていない**からです。これを解決するためには以下のようにする必要があります。

- イメージビルド時
```shell
$ docker build -t gl \
        --build-arg UID=$(id -u)\
        --build-arg GID=$(id -g)\
        --build-arg USERNAME=$(id -un)\
        --build-arg GROUPNAME=$(id -gn) .
```
ビルド時にコンテナのユーザーIDとグループIDをホストのものに指定しています。こうすることで既に認証されているホストのユーザーIDとコンテナのユーザーIDが一致するので、前述の問題を解決することができます。

- コンテナ起動時
```shell
$ docker run -it --rm \
        --hostname=gltest \
        -e DISPLAY=$DISPLAY \
        -v /tmp/.X11-unix:/tmp/.X11-unix \
        gl
```
起動時にDISPLAYの指定と/tmp/.X11-unixのマウントをしています。前者に関してはホストのDISPLAYを指定することでホストにウィンドウが表示されるようにしています。

## NVIDIA container toolkit の導入

[公式のページ](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html)におおよその内容が乗っていますが、少しだけ内容が変わります。

```shell
$ distribution=$(. /etc/os-release;echo $ID$VERSION_ID) \
      && curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg \
      && curl -s -L https://nvidia.github.io/libnvidia-container/$distribution/libnvidia-container.list | \
            sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
            sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
$ sudo apt update
$ sudo apt install nvidia-container-runtime -y
```
これでコンテナからNVIDIAのGPUが見えるようになります。

## DockerでのGPU利用

```shell
$ docker run -it --rm \
        --gpus all \
        --hostname=gltest \
        -e DISPLAY=$DISPLAY \
        -e NVIDIA_DRIVER_CAPABILITIES=all \
        -v /tmp/.X11-unix:/tmp/.X11-unix \
        gl
```
コンテナ起動時に`--gpus`によりコンテナで使いたいGPUの指定を行い、NVIDIA_DRIVER_CAPABILITIESをallと指定することで、GPUによる計算やグラフィックス、GUIへの出力などすべての機能が使えるようになります。

こうして起動したコンテナ上でサンプルアプリケーションを実行してみると、ホスト上で以下のようにウィンドウを表示することができます。
![Screenshot from 2022-07-19 06-49-24.png](https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/568499/65b0049a-75b6-2a64-f65f-ea455f03855e.png)

# まとめ
　本記事ではDockerコンテナ内でOpenGLを用いたGUIアプリケーションを起動する方法を解説していきました。これに加えて、vscodeの拡張も使って開発を行っていけばホストで開発していくのと遜色ない利便性が得られると思います。シミュレーション系の研究をやっている方であれば環境を自由に作ったり消したりできて便利なので、非常にオススメです。
