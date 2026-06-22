package com.volcanic.musicplayer;

import android.Manifest;
import android.app.Activity;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.MediaStore;
import android.text.TextUtils;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.BaseAdapter;
import android.widget.Button;
import android.widget.HorizontalScrollView;
import android.widget.LinearLayout;
import android.widget.ListView;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

public class MainActivity extends Activity {
    private static final int REQ_PICK_AUDIO = 4001;
    private static final int REQ_READ_AUDIO = 4002;

    private final ArrayList<AudioTrack> tracks = new ArrayList<>();
    private final Set<String> knownUris = new HashSet<>();

    private TrackAdapter adapter;
    private TextView statusText;
    private TextView nowTitle;
    private TextView nowMeta;
    private Button playButton;
    private MediaPlayer player;
    private int currentIndex = -1;
    private boolean prepared = false;
    private File playlistFile;

    private final int bg = Color.rgb(5, 7, 10);
    private final int panel = Color.rgb(17, 23, 32);
    private final int panelSoft = Color.rgb(23, 31, 43);
    private final int cyan = Color.rgb(111, 247, 255);
    private final int red = Color.rgb(255, 63, 87);
    private final int text = Color.rgb(246, 248, 251);
    private final int muted = Color.rgb(150, 164, 190);

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        playlistFile = new File(getFilesDir(), "playlist.json");
        buildUi();
        loadPlaylist();
        refreshUi();
    }

    @Override
    protected void onDestroy() {
        releasePlayer();
        super.onDestroy();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_PICK_AUDIO && resultCode == RESULT_OK && data != null) {
            importPickedAudio(data);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_READ_AUDIO && grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            scanMediaStore();
        } else if (requestCode == REQ_READ_AUDIO) {
            toast("未授予音频读取权限");
        }
    }

    private void buildUi() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(18), dp(18), dp(18), dp(12));
        root.setBackgroundColor(bg);
        setContentView(root);

        LinearLayout header = card(LinearLayout.HORIZONTAL, dp(16), dp(14));
        header.setGravity(Gravity.CENTER_VERTICAL);
        root.addView(header, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        TextView logo = textView("V", 22, Color.BLACK, Typeface.BOLD);
        logo.setGravity(Gravity.CENTER);
        logo.setBackground(round(red, dp(12), red));
        header.addView(logo, new LinearLayout.LayoutParams(dp(52), dp(52)));

        LinearLayout titleBlock = new LinearLayout(this);
        titleBlock.setOrientation(LinearLayout.VERTICAL);
        titleBlock.setPadding(dp(14), 0, 0, 0);
        header.addView(titleBlock, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        titleBlock.addView(textView("Volcanic", 24, text, Typeface.BOLD));
        titleBlock.addView(textView("本地音乐库", 13, muted, Typeface.NORMAL));

        statusText = textView("等待导入音乐", 13, cyan, Typeface.BOLD);
        statusText.setGravity(Gravity.END);
        header.addView(statusText, new LinearLayout.LayoutParams(dp(130), ViewGroup.LayoutParams.WRAP_CONTENT));

        HorizontalScrollView actionScroll = new HorizontalScrollView(this);
        actionScroll.setHorizontalScrollBarEnabled(false);
        root.addView(actionScroll, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        LinearLayout actions = new LinearLayout(this);
        actions.setOrientation(LinearLayout.HORIZONTAL);
        actions.setPadding(0, dp(12), 0, dp(12));
        actionScroll.addView(actions);
        actions.addView(actionButton("导入音频", this::openAudioPicker));
        actions.addView(actionButton("扫描本机", v -> requestScan()));
        actions.addView(actionButton("清空列表", v -> clearPlaylist()));
        actions.addView(actionButton("保存列表", v -> savePlaylist()));

        ListView listView = new ListView(this);
        listView.setDivider(null);
        listView.setCacheColorHint(Color.TRANSPARENT);
        listView.setBackgroundColor(Color.TRANSPARENT);
        adapter = new TrackAdapter();
        listView.setAdapter(adapter);
        listView.setOnItemClickListener((parent, view, position, id) -> playIndex(position));
        listView.setOnItemLongClickListener((parent, view, position, id) -> {
            removeAt(position);
            return true;
        });
        root.addView(listView, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1));

        LinearLayout playerBar = card(LinearLayout.VERTICAL, dp(16), dp(12));
        root.addView(playerBar, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        nowTitle = textView("还没有播放歌曲", 17, text, Typeface.BOLD);
        nowTitle.setSingleLine(true);
        nowTitle.setEllipsize(TextUtils.TruncateAt.END);
        playerBar.addView(nowTitle);

        nowMeta = textView("选择音频开始播放", 12, muted, Typeface.NORMAL);
        nowMeta.setSingleLine(true);
        nowMeta.setEllipsize(TextUtils.TruncateAt.END);
        playerBar.addView(nowMeta);

        LinearLayout controls = new LinearLayout(this);
        controls.setGravity(Gravity.CENTER);
        controls.setPadding(0, dp(10), 0, 0);
        playerBar.addView(controls, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        controls.addView(controlButton("上一首", v -> previousTrack()));
        playButton = controlButton("播放", v -> togglePlay());
        playButton.setBackground(round(red, dp(18), red));
        controls.addView(playButton);
        controls.addView(controlButton("下一首", v -> nextTrack()));
    }

    private void openAudioPicker(View ignored) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("audio/*");
        intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        startActivityForResult(intent, REQ_PICK_AUDIO);
    }

    private void importPickedAudio(Intent data) {
        int before = tracks.size();
        if (data.getClipData() != null) {
            for (int i = 0; i < data.getClipData().getItemCount(); i++) {
                addDocumentUri(data.getClipData().getItemAt(i).getUri(), data);
            }
        } else if (data.getData() != null) {
            addDocumentUri(data.getData(), data);
        }
        if (tracks.size() > before) {
            savePlaylist();
            refreshUi();
            toast("已导入 " + (tracks.size() - before) + " 首");
        }
    }

    private void addDocumentUri(Uri uri, Intent grantData) {
        try {
            getContentResolver().takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
        } catch (Exception ignored) {
            // Some providers do not expose persistable permissions.
        }
        addTrack(new AudioTrack(displayName(uri), "导入文件", uri.toString()));
    }

    private void requestScan() {
        String permission = Build.VERSION.SDK_INT >= 33 ? Manifest.permission.READ_MEDIA_AUDIO : Manifest.permission.READ_EXTERNAL_STORAGE;
        if (Build.VERSION.SDK_INT >= 23 && checkSelfPermission(permission) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{permission}, REQ_READ_AUDIO);
            return;
        }
        scanMediaStore();
    }

    private void scanMediaStore() {
        int before = tracks.size();
        String[] projection = {
                MediaStore.Audio.Media._ID,
                MediaStore.Audio.Media.TITLE,
                MediaStore.Audio.Media.ARTIST,
                MediaStore.Audio.Media.DISPLAY_NAME
        };
        String selection = MediaStore.Audio.Media.IS_MUSIC + "!=0";
        try (Cursor cursor = getContentResolver().query(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, projection, selection, null, MediaStore.Audio.Media.DATE_ADDED + " DESC")) {
            if (cursor == null) {
                toast("没有读取到媒体库");
                return;
            }
            int idIndex = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media._ID);
            int titleIndex = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.TITLE);
            int artistIndex = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST);
            int displayIndex = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DISPLAY_NAME);
            while (cursor.moveToNext()) {
                long id = cursor.getLong(idIndex);
                String title = valueOr(cursor.getString(titleIndex), cursor.getString(displayIndex));
                String artist = valueOr(cursor.getString(artistIndex), "本机音乐");
                Uri uri = ContentUris.withAppendedId(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, id);
                addTrack(new AudioTrack(title, artist, uri.toString()));
            }
        }
        savePlaylist();
        refreshUi();
        toast("扫描新增 " + (tracks.size() - before) + " 首");
    }

    private void addTrack(AudioTrack track) {
        if (knownUris.add(track.uri)) {
            tracks.add(track);
        }
    }

    private void playIndex(int index) {
        if (index < 0 || index >= tracks.size()) {
            return;
        }
        currentIndex = index;
        AudioTrack track = tracks.get(index);
        releasePlayer();
        prepared = false;
        player = new MediaPlayer();
        try {
            player.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build());
            player.setDataSource(this, Uri.parse(track.uri));
            player.setOnPreparedListener(mp -> {
                prepared = true;
                mp.start();
                refreshUi();
            });
            player.setOnCompletionListener(mp -> nextTrack());
            player.prepareAsync();
            nowTitle.setText(track.title);
            nowMeta.setText("正在加载");
            refreshUi();
        } catch (Exception error) {
            toast("无法播放：" + track.title);
            releasePlayer();
        }
    }

    private void togglePlay() {
        if (tracks.isEmpty()) {
            toast("请先导入音乐");
            return;
        }
        if (player == null) {
            playIndex(currentIndex >= 0 ? currentIndex : 0);
            return;
        }
        if (!prepared) {
            return;
        }
        if (player.isPlaying()) {
            player.pause();
        } else {
            player.start();
        }
        refreshUi();
    }

    private void previousTrack() {
        if (tracks.isEmpty()) {
            return;
        }
        int next = currentIndex <= 0 ? tracks.size() - 1 : currentIndex - 1;
        playIndex(next);
    }

    private void nextTrack() {
        if (tracks.isEmpty()) {
            return;
        }
        int next = currentIndex < 0 || currentIndex >= tracks.size() - 1 ? 0 : currentIndex + 1;
        playIndex(next);
    }

    private void removeAt(int position) {
        if (position < 0 || position >= tracks.size()) {
            return;
        }
        AudioTrack removed = tracks.remove(position);
        knownUris.remove(removed.uri);
        if (position == currentIndex) {
            releasePlayer();
            currentIndex = -1;
        } else if (position < currentIndex) {
            currentIndex--;
        }
        savePlaylist();
        refreshUi();
    }

    private void clearPlaylist() {
        releasePlayer();
        tracks.clear();
        knownUris.clear();
        currentIndex = -1;
        savePlaylist();
        refreshUi();
    }

    private void savePlaylist() {
        JSONArray array = new JSONArray();
        try {
            for (AudioTrack track : tracks) {
                JSONObject object = new JSONObject();
                object.put("title", track.title);
                object.put("subtitle", track.subtitle);
                object.put("uri", track.uri);
                array.put(object);
            }
            try (FileOutputStream output = new FileOutputStream(playlistFile)) {
                output.write(array.toString(2).getBytes(StandardCharsets.UTF_8));
            }
            statusText.setText(String.format(Locale.CHINA, "%d 首", tracks.size()));
        } catch (Exception error) {
            toast("保存列表失败");
        }
    }

    private void loadPlaylist() {
        if (!playlistFile.exists()) {
            return;
        }
        try (FileInputStream input = new FileInputStream(playlistFile)) {
            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            byte[] chunk = new byte[4096];
            int read;
            while ((read = input.read(chunk)) != -1) {
                buffer.write(chunk, 0, read);
            }
            JSONArray array = new JSONArray(buffer.toString(StandardCharsets.UTF_8.name()));
            for (int i = 0; i < array.length(); i++) {
                JSONObject object = array.getJSONObject(i);
                addTrack(new AudioTrack(
                        object.optString("title", "未知音频"),
                        object.optString("subtitle", "已保存"),
                        object.optString("uri")
                ));
            }
        } catch (Exception error) {
            toast("读取列表失败");
        }
    }

    private void refreshUi() {
        statusText.setText(tracks.isEmpty() ? "等待导入音乐" : tracks.size() + " 首");
        if (adapter != null) {
            adapter.notifyDataSetChanged();
        }
        if (player != null && prepared) {
            playButton.setText(player.isPlaying() ? "暂停" : "播放");
        } else {
            playButton.setText("播放");
        }
        if (currentIndex >= 0 && currentIndex < tracks.size()) {
            AudioTrack track = tracks.get(currentIndex);
            nowTitle.setText(track.title);
            nowMeta.setText(track.subtitle);
        } else {
            nowTitle.setText("还没有播放歌曲");
            nowMeta.setText(tracks.isEmpty() ? "选择音频开始播放" : "点按列表歌曲播放");
        }
    }

    private void releasePlayer() {
        prepared = false;
        if (player != null) {
            player.release();
            player = null;
        }
    }

    private String displayName(Uri uri) {
        String name = null;
        try (Cursor cursor = getContentResolver().query(uri, new String[]{MediaStore.MediaColumns.DISPLAY_NAME}, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                name = cursor.getString(0);
            }
        } catch (Exception ignored) {
        }
        if (name == null || name.trim().isEmpty()) {
            name = uri.getLastPathSegment();
        }
        return valueOr(name, "未知音频");
    }

    private String valueOr(String value, String fallback) {
        return value == null || value.trim().isEmpty() ? fallback : value;
    }

    private Button actionButton(String label, View.OnClickListener listener) {
        Button button = new Button(this);
        button.setText(label);
        button.setTextColor(text);
        button.setTextSize(13);
        button.setAllCaps(false);
        button.setBackground(round(panelSoft, dp(9), Color.argb(70, 111, 247, 255)));
        button.setOnClickListener(listener);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, dp(42));
        params.setMargins(0, 0, dp(8), 0);
        button.setLayoutParams(params);
        return button;
    }

    private Button controlButton(String label, View.OnClickListener listener) {
        Button button = new Button(this);
        button.setText(label);
        button.setTextColor(text);
        button.setTextSize(13);
        button.setAllCaps(false);
        button.setBackground(round(panelSoft, dp(18), Color.TRANSPARENT));
        button.setOnClickListener(listener);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(dp(92), dp(44));
        params.setMargins(dp(5), 0, dp(5), 0);
        button.setLayoutParams(params);
        return button;
    }

    private LinearLayout card(int orientation, int horizontalPadding, int verticalPadding) {
        LinearLayout view = new LinearLayout(this);
        view.setOrientation(orientation);
        view.setPadding(horizontalPadding, verticalPadding, horizontalPadding, verticalPadding);
        view.setBackground(round(panel, dp(14), Color.argb(42, 111, 247, 255)));
        return view;
    }

    private TextView textView(String value, int sp, int color, int style) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(sp);
        view.setTextColor(color);
        view.setTypeface(Typeface.DEFAULT, style);
        view.setIncludeFontPadding(true);
        return view;
    }

    private GradientDrawable round(int fill, int radius, int stroke) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(fill);
        drawable.setCornerRadius(radius);
        if (stroke != Color.TRANSPARENT) {
            drawable.setStroke(1, stroke);
        }
        return drawable;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private void toast(String message) {
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show();
    }

    private final class TrackAdapter extends BaseAdapter {
        @Override
        public int getCount() {
            return tracks.size();
        }

        @Override
        public Object getItem(int position) {
            return tracks.get(position);
        }

        @Override
        public long getItemId(int position) {
            return position;
        }

        @Override
        public View getView(int position, View convertView, ViewGroup parent) {
            AudioTrack track = tracks.get(position);
            LinearLayout row = card(LinearLayout.HORIZONTAL, dp(12), dp(10));
            row.setGravity(Gravity.CENTER_VERTICAL);
            LinearLayout.LayoutParams rowParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            rowParams.setMargins(0, 0, 0, dp(8));
            row.setLayoutParams(rowParams);

            TextView index = textView(String.valueOf(position + 1), 14, position == currentIndex ? cyan : muted, Typeface.BOLD);
            index.setGravity(Gravity.CENTER);
            row.addView(index, new LinearLayout.LayoutParams(dp(34), dp(42)));

            LinearLayout copy = new LinearLayout(MainActivity.this);
            copy.setOrientation(LinearLayout.VERTICAL);
            copy.setPadding(dp(8), 0, 0, 0);
            row.addView(copy, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));

            TextView titleView = textView(track.title, 15, text, Typeface.BOLD);
            titleView.setSingleLine(true);
            titleView.setEllipsize(TextUtils.TruncateAt.END);
            copy.addView(titleView);

            TextView subtitleView = textView(track.subtitle, 12, muted, Typeface.NORMAL);
            subtitleView.setSingleLine(true);
            subtitleView.setEllipsize(TextUtils.TruncateAt.END);
            copy.addView(subtitleView);

            TextView hint = textView("长按删除", 11, muted, Typeface.NORMAL);
            row.addView(hint);
            return row;
        }
    }

    private static final class AudioTrack {
        final String title;
        final String subtitle;
        final String uri;

        AudioTrack(String title, String subtitle, String uri) {
            this.title = title;
            this.subtitle = subtitle;
            this.uri = uri;
        }
    }
}
