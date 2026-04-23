use domain::ModelFieldKind;

#[derive(Debug, Clone)]
pub struct FileFieldTemplate {
    pub code: String,
    pub title: String,
    pub field_kind: ModelFieldKind,
    pub is_required: bool,
}

pub fn attachments_template_fields() -> Vec<FileFieldTemplate> {
    vec![
        FileFieldTemplate {
            code: "title".into(),
            title: "标题".into(),
            field_kind: ModelFieldKind::String,
            is_required: false,
        },
        FileFieldTemplate {
            code: "filename".into(),
            title: "文件名".into(),
            field_kind: ModelFieldKind::String,
            is_required: true,
        },
        FileFieldTemplate {
            code: "extname".into(),
            title: "扩展名".into(),
            field_kind: ModelFieldKind::String,
            is_required: false,
        },
        FileFieldTemplate {
            code: "size".into(),
            title: "大小".into(),
            field_kind: ModelFieldKind::Number,
            is_required: true,
        },
        FileFieldTemplate {
            code: "mimetype".into(),
            title: "MIME 类型".into(),
            field_kind: ModelFieldKind::String,
            is_required: true,
        },
        FileFieldTemplate {
            code: "path".into(),
            title: "存储路径".into(),
            field_kind: ModelFieldKind::String,
            is_required: true,
        },
        FileFieldTemplate {
            code: "meta".into(),
            title: "元数据".into(),
            field_kind: ModelFieldKind::Json,
            is_required: true,
        },
        FileFieldTemplate {
            code: "url".into(),
            title: "缓存地址".into(),
            field_kind: ModelFieldKind::String,
            is_required: false,
        },
        FileFieldTemplate {
            code: "storage_id".into(),
            title: "存储器 ID".into(),
            field_kind: ModelFieldKind::String,
            is_required: true,
        },
    ]
}
